import {Parser} from './common.js'
import {IDENT_RX, isAlnum, isAlpha, OPERATOR_RX, Token, Tokenizer, TokenKind, WSNL_RX, WS_RX} from '../tokenizer.js'
import {ParseError} from '../errors.js'

export default (input: string) =>
  new Parser(new SymfonyTokenizer(preprocess(input))).parse()

const ANYCRLF_RX = /\r\n|\r/g
const ASSIGN_RX = /(?:export[ \t]+)?(?<name>[a-zA-Z_][a-zA-Z0-9_]*)=/y

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
      default:
        this.buffer += cc
        break
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
      default:
        this.buffer += cc
        break
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
      default:
        this.buffer += cc
        break
    }
  }

  private *dollarState() {
    const cc = this.consumeTheNextCharacter()
    switch (cc) {
      case '{':
        this.state = this.complexExpansionStartState
        break
      default: {
        if (cc === '_' || isAlpha(cc)) {
          yield* this.flushTheTemporaryBuffer()
          this.buffer += cc
          this.state = this.simpleExpansionState
          break
        }
        this.buffer += '$'
        this.reconsumeIn(this.returnStates.pop()!)
        break
      }
    }
  }

  private *simpleExpansionState() {
    const cc = this.consumeTheNextCharacter()
    if (cc === '_' || isAlnum(cc)) {
      this.buffer += cc
      return
    }
    yield* this.flushTheTemporaryBuffer(TokenKind.SimpleExpansion)
    this.reconsumeIn(this.returnStates.pop()!)
  }

  private *complexExpansionStartState() {
    const cc = this.consumeTheNextCharacter()
    if (cc === '_' || isAlpha(cc)) {
      this.buffer += cc
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
      case ':':
        yield* this.flushTheTemporaryBuffer(TokenKind.StartExpansion)
        this.buffer += cc
        this.state = this.expansionOperatorState
        break
      case '?': case '=': case '+': case '-':
        yield* this.flushTheTemporaryBuffer(TokenKind.StartExpansion)
        yield new Token(TokenKind.ExpansionOperator, cc, this.pos)
        this.state = this.expansionValueState
        break
      default:
        if (cc === '_' || isAlnum(cc)) {
          this.buffer += cc
          break
        }
        throw this.unexpectedChar(cc)
    }
  }

  private *expansionOperatorState() {
    const cc = this.consumeTheNextCharacter()
    switch (cc) {
      case '?': case '=': case '+': case '-':
        this.buffer += cc
        yield* this.flushTheTemporaryBuffer(TokenKind.ExpansionOperator)
        this.state = this.expansionValueState
        break
      default:
        throw this.unexpectedChar(cc)
    }
  }

  private *expansionValueState() {
    const cc = this.consumeTheNextCharacter()
    switch (cc) {
      case '':
        throw new ParseError(`Unterminated expansion at offset ${this.pos}`)
      case '"': case "'": case '$': case '{':
        this.unexpectedChar(cc)
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
      default:
        this.buffer += cc
        break
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
