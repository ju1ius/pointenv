import {Parser} from './common.js'
import {ParseError} from '../errors.js'
import {COMMENT_RX, IDENT_RX, State, Token, TokenKind, WSNL_RX} from '../tokenizer.js'


export default (input: string) =>
  new Parser(new Tokenizer(input)).parse()


const ASSIGN_RX = /([a-zA-Z_][a-zA-Z0-9_]*)=/y
const VALUE_CHAR_RX = /[^\\ \t\n'"`$|&;<>()]+/y
const SQ_RX = /[^']+/y
const DQ_RX = /[^\\"`$]+/y
const EXP_VALUE_CHAR_RX = /[^\\}$"`']+/y

export class Tokenizer {
  private pos: number = -1
  private state: State | null = this.assignmentListState
  private quotingLevel: number = 0
  private returnStates: State[] = []
  private buffer: string = ''

  constructor(
    private readonly input: string
  ) {
  }

  *tokenize() {
    this.pos = -1
    this.state = this.assignmentListState
    this.quotingLevel = 0
    this.returnStates = []
    this.buffer = ''

    while (this.state) {
      yield* this.state()
    }
  }

  private *assignmentListState() {
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
      default:
        ASSIGN_RX.lastIndex = this.pos
        const m = ASSIGN_RX.exec(this.input)
        if (m) {
          // assignment name state
          yield new Token(TokenKind.Assign, m[1], this.pos)
          this.pos += m[0].length - 1
          this.state = this.assignmentValueState
          return
        }
        throw this.unexpectedChar(cc)
    }
  }

  private *commentState() {
    const cc = this.consumeTheNextCharacter()
    switch (cc) {
      case '':
        yield this.eof()
        break
      case "\n":
        this.state = this.assignmentListState
        break
      default: {
        COMMENT_RX.lastIndex = this.pos
        const m = COMMENT_RX.exec(this.input)!
        this.pos += m[0].length - 1
        break
      }
    }
  }

  private *assignmentValueState() {
    const cc = this.consumeTheNextCharacter()
    switch (cc) {
      case '':
        yield* this.flushTheTemporaryBuffer()
        yield this.eof()
        break
      case ' ': case "\t": case "\n":
        yield* this.flushTheTemporaryBuffer()
        this.state = this.assignmentListState
        break
      case '\\':
        this.state = this.assignmentValueEscapeState
        break
      case "'":
        this.returnStates.push(this.assignmentValueState)
        this.state = this.singleQuotedState
        break
      case '"':
        this.quotingLevel++
        this.returnStates.push(this.assignmentValueState)
        this.state = this.doubleQuotedState
        break
      case '$':
        this.returnStates.push(this.assignmentValueState)
        this.state = this.dollarState
        break
      case '`':
        throw new ParseError(`Unsupported command expansion at offset ${this.pos}`)
      case '|': case '&': case ';': case '<': case '>': case '(': case ')':
        throw new ParseError(`Unescaped special shell character "${cc}" at offset ${this.pos}`)
      default: {
        VALUE_CHAR_RX.lastIndex = this.pos
        const m = VALUE_CHAR_RX.exec(this.input)!
        this.buffer += m[0]
        this.pos += m[0].length - 1
        break
      }
    }
  }

  private *assignmentValueEscapeState() {
    const cc = this.consumeTheNextCharacter()
    switch (cc) {
      case '':
        this.buffer += '\\'
        yield* this.flushTheTemporaryBuffer()
        yield this.eof()
        break
      case '\n':
        this.state = this.assignmentValueState
        break
      default:
        this.buffer += cc
        this.state = this.assignmentValueState
        break
    }
  }

  private *singleQuotedState() {
    const cc = this.consumeTheNextCharacter()
    switch (cc) {
      case '':
        throw new ParseError(`Unterminated single-quoted string at offset ${this.pos}`)
      case "'":
        this.state = this.returnStates.pop()!
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
      case '`':
        throw new ParseError(`Unsupported command expansion at offset ${this.pos}`)
      case '"':
        this.quotingLevel--
        this.state = this.returnStates.pop()!
        break
      case '\\':
        this.state = this.doubleQuotedEscapeState
        break
      case '$':
        this.returnStates.push(this.doubleQuotedState)
        this.state = this.dollarState
        break
      default: {
        DQ_RX.lastIndex = this.pos
        const m = DQ_RX.exec(this.input)!
        this.buffer += m[0]
        this.pos += m[0].length - 1
      }
    }
  }

  private *doubleQuotedEscapeState() {
    const cc = this.consumeTheNextCharacter()
    switch (cc) {
      case '':
        throw new ParseError(`Unterminated double-quoted string at offset ${this.pos}`)
      case '\n':
        this.state = this.doubleQuotedState
        break
      case '"': case '$': case '`': case '\\':
        this.buffer += cc
        this.state = this.doubleQuotedState
        break
      default:
        this.buffer += `\\${cc}`
        this.state = this.doubleQuotedState
        break
    }
  }

  private *dollarState() {
    const cc = this.consumeTheNextCharacter()
    switch (cc) {
      case '0': case '1': case '2': case '3': case '4': case '5': case '6': case '7': case '8': case '9':
      case '@': case '*': case '#': case '?': case '$': case '!': case '-':
        throw new ParseError(`Unsupported special shell parameter \$${cc} at offset ${this.pos}`)
      case '(':
        throw new ParseError(`Unsupported command or arithmetic expansion at offset ${this.pos}`)
      case '{':
        yield* this.flushTheTemporaryBuffer()
        this.state = this.complexExpansionStartState
        break
      default: {
        IDENT_RX.lastIndex = this.pos
        const m = IDENT_RX.exec(this.input)
        if (m) {
          yield* this.flushTheTemporaryBuffer()
          // simple expansion state
          yield new Token(TokenKind.SimpleExpansion, m[0], this.pos)
          this.pos += m[0].length - 1
          this.state = this.returnStates.pop()!
          break
        }
        this.buffer += '$'
        this.reconsumeIn(this.returnStates.pop()!)
        break
      }
    }
  }

  private *complexExpansionStartState() {
    const cc = this.consumeTheNextCharacter()
    switch (cc) {
      case '0': case '1': case '2': case '3': case '4': case '5': case '6': case '7': case '8': case '9':
      case '@': case '*': case '#': case '?': case '$': case '!': case '-':
        throw new ParseError(`Unsupported special shell parameter \${${cc}} at offset ${this.pos}`)
      default: {
        IDENT_RX.lastIndex = this.pos
        const m = IDENT_RX.exec(this.input)
        if (m) {
          yield* this.flushTheTemporaryBuffer()
          // part of complex expansion state
          this.buffer += m[0]
          this.pos += m[0].length - 1
          this.state = this.complexExpansionState
          break
        }
        throw this.unexpectedChar(cc)
      }
    }
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
      case '`':
        throw new ParseError(`Unsupported command expansion at offset ${this.pos}`)
      case '}':
        yield* this.flushTheTemporaryBuffer()
        yield new Token(TokenKind.EndExpansion, '}', this.pos)
        this.state = this.returnStates.pop()!
        break
      case '\\':
        this.state = this.expansionValueEscapeState
        break
      case '$':
        this.returnStates.push(this.expansionValueState)
        this.state = this.dollarState
        break
      case '"':
        this.quotingLevel++
        this.returnStates.push(this.expansionValueState)
        this.state = this.doubleQuotedState
        break
      case "'":
        if (this.quotingLevel > 0) {
          this.buffer += cc
        } else {
          this.returnStates.push(this.expansionValueState)
          this.state = this.singleQuotedState
        }
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

  private *expansionValueEscapeState() {
    const cc = this.consumeTheNextCharacter()
    switch (cc) {
      case '':
        throw new ParseError(`Unterminated expansion at offset ${this.pos}`)
      case '\n':
        this.state = this.expansionValueState
        break
      case '"': case '$': case '`': case '\\':
        this.buffer += cc
        this.state = this.expansionValueState
        break
      default:
        if (this.quotingLevel > 0) {
          this.buffer += '\\'
        }
        this.buffer += cc
        this.state = this.expansionValueState
        break
    }
  }

  private eof() {
    this.state = null
    return new Token(TokenKind.EOF, '', this.pos)
  }

  private *flushTheTemporaryBuffer(kind: TokenKind = TokenKind.Characters) {
    if (this.buffer.length) {
      yield new Token(kind, this.buffer, this.pos)
    }
    this.buffer = ''
  }

  private consumeTheNextCharacter() {
    return this.input.charAt(++this.pos)
  }

  private reconsumeIn(state: State) {
    --this.pos
    this.state = state
  }

  private unexpectedChar(cc: string) {
    const state = this.state?.name
    if (cc === '') {
      return new ParseError(`Unexpected end of input in ${state} at offset ${this.pos}.`)
    }
    return new ParseError(`Unexpected character "${cc}" in ${state} at offset ${this.pos}.`)
  }
}
