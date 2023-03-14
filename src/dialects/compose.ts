import {Parser} from './common.js'
import {IDENT_RX, OPERATOR_RX, Token, Tokenizer, TokenKind, WSNL_RX, WS_RX} from '../tokenizer.js'
import {ParseError} from '../errors.js'

export default (input: string) => {
  return new Parser(new ComposeTokenizer(input)).parse()
}

const DQUOTED_ESCAPES = new Map<string, string>([
  ['f', '\f'],
  ['n', '\n'],
  ['r', '\r'],
  ['t', '\t'],
  ['v', '\v'],
  ['\\', '\\'],
  ['$', '$'],
  ['"', '"'],
])

const ASSIGN_RX = /(?:export[ \t]+)?(?<name>[a-zA-Z_][a-zA-Z0-9_]*)[ \t]*=[ \t]*/y
const UQ_RX = /[^$ \t\n]+/y
const SQ_RX = /[^'\\]+/y
const DQ_RX = /[^"$\\]+/y
const EXP_VALUE_CHAR_RX = /[^}$]+/y

class ComposeTokenizer extends Tokenizer {
  constructor(input: string) {
    super(input)
  }

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
          this.reconsumeIn(this.assignmentValueState)
          break
        }
        throw this.unexpectedChar(cc)
      }
    }
  }

  protected *assignmentValueState() {
    const cc = this.consumeTheNextCharacter()
    switch (cc) {
      case '':
        yield* this.flushTheTemporaryBuffer()
        yield this.eof()
        return
      case '\n':
        yield* this.flushTheTemporaryBuffer()
        this.state = this.assignmentListState
        break
      case "'":
        this.state = this.singleQuotedState
        break
      case '"':
        this.state = this.doubleQuotedState
        break
      default:
        this.reconsumeIn(this.unquotedState)
        break
    }
  }

  private *unquotedState() {
    const cc = this.consumeTheNextCharacter()
    switch (cc) {
      case '':
        yield* this.flushTheTemporaryBuffer()
        yield this.eof()
        return
      case '\n':
        yield* this.flushTheTemporaryBuffer()
        this.state = this.assignmentListState
        break
      case '$':
        this.returnStates.push(this.state!)
        this.state = this.dollarState
        break
      case ' ': case "\t": {
        const ws = this.consumeWhitespace()
        switch (this.input.charAt(this.pos)) {
          case '': case '\n': case '#':
            yield* this.flushTheTemporaryBuffer()
            this.reconsumeIn(this.assignmentListState)
            break
          default:
            --this.pos
            this.buffer += ws
            break
        }
        break
      }
      default: {
        UQ_RX.lastIndex = this.pos
        const m = UQ_RX.exec(this.input)!
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
      case '\\': {
        const cn = this.input.charAt(this.pos + 1)
        this.buffer += `\\${cn}`
        ++this.pos
        break
      }
      case "'":
        yield* this.flushTheTemporaryBuffer()
        this.state = this.assignmentListState
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
        yield* this.flushTheTemporaryBuffer()
        this.state = this.assignmentListState
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
        yield* this.flushTheTemporaryBuffer()
        this.state = this.complexExpansionStartState
        break
      default: {
        const token = this.matchIdentifier(TokenKind.SimpleExpansion)
        if (token) {
          yield* this.flushTheTemporaryBuffer()
          yield token
          this.reconsumeIn(this.returnStates.pop()!)
          break
        }
        this.buffer += `$`
        this.reconsumeIn(this.returnStates.pop()!)
        break
      }
    }
  }

  private *complexExpansionStartState() {
    const cc = this.consumeTheNextCharacter()
    IDENT_RX.lastIndex = this.pos
    const m = IDENT_RX.exec(this.input)
    if (m) {
      yield* this.flushTheTemporaryBuffer()
      // part of complex expansion state
      this.buffer += m[0]
      this.pos += m[0].length - 1
      this.state = this.complexExpansionState
      return
    }
    throw this.unexpectedChar(cc)
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
          // expansion operator state
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
      case '}':
        yield* this.flushTheTemporaryBuffer()
        yield new Token(TokenKind.EndExpansion, '}', this.pos)
        this.state = this.returnStates.pop()!
        break
      case '$':
        this.returnStates.push(this.state!)
        this.state = this.dollarState
        break
      default: {
        EXP_VALUE_CHAR_RX.lastIndex = this.pos
        const m = EXP_VALUE_CHAR_RX.exec(this.input)!
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

  private matchIdentifier(kind: TokenKind) {
    IDENT_RX.lastIndex = this.pos
    const m = IDENT_RX.exec(this.input)
    if (!m) return null
    const token = new Token(kind, m[0], this.pos)
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
