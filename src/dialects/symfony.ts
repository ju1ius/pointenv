import {Parser} from './common.js'
import {IDENT_RX, OPERATOR_RX, Token, Tokenizer, TokenKind, WSNL_RX, WS_RX} from '../tokenizer.js'
import {ParseError} from '../errors.js'

export default (input: string) =>
  new Parser(new SymfonyTokenizer(preprocess(input))).parse()

const ANYCRLF_RX = /\r\n|\r/g
const ASSIGN_RX = /(?:export[ \t]+)?(?<name>[a-zA-Z_][a-zA-Z0-9_]*)=/y
const VALUE_RX = /[^ \t\n$"'\\]+/y
const SQ_RX = /[^']+/y
const DQ_RX = /[^"$\\]+/y
const EXP_VALUE_RX = /[^"'${}\\]+/y

const UNQUOTED_ESCAPES = new Map<string, string>([
  ['"', '"'],
  ["'", "'"],
  ['$', '$'],
  ['\\', '\\'],
])
const DQUOTED_ESCAPES = new Map<string, string>([
  ['"', '"'],
  ['r', '\r'],
  ['n', '\n'],
  ['\\', '\\'],
  ['$', '$'],
])

const preprocess = (input: string) => input.replace(ANYCRLF_RX, '\n')

class SymfonyTokenizer extends Tokenizer {

  protected *assignmentListState() {
    const cc = this.consumeTheNextCharacter()
    switch (cc) {
      case '':
        yield this.eof()
        return
      case ' ': case "\t": case "\n": {
        WSNL_RX.lastIndex = this.pos
        const m = WSNL_RX.exec(this.input)!
        this.pos += m[0].length - 1
        break
      }
      case '#':
        this.state = this.commentState
        break
      default: {
        const token = this.matchAssignment()
        if (token) {
          yield token
          this.reconsumeIn(this.assignmentValueStartState)
          break
        }
        throw this.unexpectedChar(cc)
      }
    }
  }

  protected *assignmentValueStartState() {
    const cc = this.consumeTheNextCharacter()
    switch (cc) {
      case ' ': case '\t': {
        const p = this.pos
        this.consumeWhitespace()
        switch (this.input.charAt(this.pos)) {
          case '': case '\n': case '#':
            this.reconsumeIn(this.assignmentListState)
            break
          default:
            throw new ParseError(`Whitespace after equal sign in assignment at offset ${p}`)
        }
        break
      }
      case '': case '\n':
        this.reconsumeIn(this.assignmentListState)
        break
      default:
        this.reconsumeIn(this.assignmentValueState)
        break
    }
  }

  protected *assignmentValueState() {
    const cc = this.consumeTheNextCharacter()
    switch (cc) {
      case '': case ' ': case '\t': case '\n':
        yield* this.flushTheTemporaryBuffer()
        this.reconsumeIn(this.assignmentListState)
        break
      case "'":
        this.state = this.singleQuotedState
        break
      case '"':
        ++this.quotingLevel
        this.state = this.doubleQuotedState
        break
      case '\\': {
        const cn = this.input.charAt(++this.pos)
        switch (cn) {
          case '\n':
            throw this.unexpectedChar(cn)
          default:
            if (UNQUOTED_ESCAPES.has(cn)) {
              this.buffer += UNQUOTED_ESCAPES.get(cn)
            } else {
              this.buffer += `\\${cn}`
            }
            break
        }
        break
      }
      case '$':
        this.returnStates.push(this.state!)
        this.state = this.dollarState
        break
      default: {
        VALUE_RX.lastIndex = this.pos
        const m = VALUE_RX.exec(this.input)!
        this.buffer += m[0]
        this.pos += m[0].length - 1
        break
      }
    }
  }

  private *singleQuotedState() {
    const cc = this.consumeTheNextCharacter()
    switch (cc) {
      case '':
        throw new ParseError(`Unterminated single-quoted string at offset ${this.pos}`)
      case "'":
        this.state = this.assignmentValueState
        break
      default: {
        SQ_RX.lastIndex = this.pos
        const m = SQ_RX.exec(this.input)!
        this.buffer += m[0]
        this.pos += m[0].length - 1
        break
      }
    }
  }

  private *doubleQuotedState() {
    const cc = this.consumeTheNextCharacter()
    switch (cc) {
      case '':
        throw new ParseError(`Unterminated double-quoted string at offset ${this.pos}`)
      case '"':
        --this.quotingLevel
        this.state = this.assignmentValueState
        break
      case '\\': {
        const cn = this.input.charAt(++this.pos)
        if (DQUOTED_ESCAPES.has(cn)) {
          this.buffer += DQUOTED_ESCAPES.get(cn)
        } else {
          this.buffer += `\\${cn}`
        }
        break
      }
      case '$':
        this.returnStates.push(this.state!)
        this.state = this.dollarState
        break
      default: {
        DQ_RX.lastIndex = this.pos
        const m = DQ_RX.exec(this.input)!
        this.buffer += m[0]
        this.pos += m[0].length - 1
        break
      }
    }
  }

  private *dollarState() {
    const cc = this.consumeTheNextCharacter()
    switch (cc) {
      case '{':
        this.state = this.complexExpansionStartState
        break
      default: {
        IDENT_RX.lastIndex = this.pos
        const m = IDENT_RX.exec(this.input)
        if (m) {
          yield* this.flushTheTemporaryBuffer()
          yield new Token(TokenKind.SimpleExpansion, m[0], this.pos)
          this.pos += m[0].length
          this.reconsumeIn(this.returnStates.pop()!)
          break
        }
        this.buffer += '$'
        this.reconsumeIn(this.returnStates.pop()!)
        break
      }
    }
  }

  private *complexExpansionStartState() {
    this.consumeTheNextCharacter()
    IDENT_RX.lastIndex = this.pos
    const m = IDENT_RX.exec(this.input)
    if (m) {
      yield* this.flushTheTemporaryBuffer()
      this.buffer += m[0]
      this.pos += m[0].length - 1
      this.state = this.complexExpansionState
      return
    }
    this.buffer += '${'
    this.reconsumeIn(this.returnStates.pop()!)
  }

  private *complexExpansionState() {
    const cc = this.consumeTheNextCharacter()
    switch (cc) {
      case '}':
        yield* this.flushTheTemporaryBuffer(TokenKind.SimpleExpansion)
        this.state = this.returnStates.pop()!
        break
      default: {
        OPERATOR_RX.lastIndex = this.pos
        const m = OPERATOR_RX.exec(this.input)
        if (m) {
          yield* this.flushTheTemporaryBuffer(TokenKind.StartExpansion)
          yield new Token(TokenKind.ExpansionOperator, m[0], this.pos)
          this.pos += m[0].length - 1
          this.state = this.expansionValueState
          break
        }
        throw this.unexpectedChar(cc)
      }
    }
  }

  private *expansionValueState() {
    const cc = this.consumeTheNextCharacter()
    switch (cc) {
      case '':
        throw new ParseError(`Unterminated expansion at offset ${this.pos}`)
      case '"': case "'": case '$': case '{':
        throw this.unexpectedChar(cc)
      case '}':
        yield* this.flushTheTemporaryBuffer()
        yield new Token(TokenKind.EndExpansion, '}', this.pos)
        this.state = this.returnStates.pop()!
        break
      case '\\': {
        const cn = this.input.charAt(++this.pos)
        if (this.quotingLevel > 0 && DQUOTED_ESCAPES.has(cn)) {
          this.buffer += DQUOTED_ESCAPES.get(cn)
        } else {
          this.buffer += `\\${cn}`
        }
        break
      }
      default: {
        EXP_VALUE_RX.lastIndex = this.pos
        const m = EXP_VALUE_RX.exec(this.input)!
        this.buffer += m[0]
        this.pos += m[0].length - 1
        break
      }
    }
  }

  private matchAssignment() {
    ASSIGN_RX.lastIndex = this.pos
    const m = ASSIGN_RX.exec(this.input)
    if (!m) return null
    const token = new Token(TokenKind.Assign, m.groups!.name, this.pos)
    this.pos += m[0].length
    return token
  }

  private consumeWhitespace() {
    WS_RX.lastIndex = this.pos
    const m = WS_RX.exec(this.input)!
    this.pos += m[0].length
    return m[0]
  }
}
