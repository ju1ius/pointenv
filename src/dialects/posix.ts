import {Parser} from './common/parser.ts'
import {ParseError} from '../errors.ts'
import {COMMENT_RX, IDENT_RX, OPERATOR_RX, Token, Tokenizer, TokenKind, WSNL_RX} from './common/tokenizer.ts'
import type {Source} from '../source.ts'


export default (src: Source) =>
  new Parser(new PosixTokenizer()).parse(src)


const ASSIGN_RX = /([a-zA-Z_][a-zA-Z0-9_]*)=/y
const VALUE_CHAR_RX = /[^\\ \t\n'"`$|&;<>()]+/y
const SQ_RX = /[^']+/y
const DQ_RX = /[^\\"`$]+/y
const EXP_VALUE_CHAR_RX = /[^\\}$"`']+/y

export class PosixTokenizer extends Tokenizer {

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
      case '#': {
        COMMENT_RX.lastIndex = this.pos
        const m = COMMENT_RX.exec(this.input)!
        this.pos += m[0].length - 1
        break
      }
      default: {
        ASSIGN_RX.lastIndex = this.pos
        const m = ASSIGN_RX.exec(this.input)
        if (m) {
          this.bufferPos = this.pos
          // assignment name state
          yield new Token(TokenKind.Assign, m[1], this.pos)
          this.pos += m[0].length - 1
          this.state = this.assignmentValueState
          return
        }
        throw this.unexpectedChar(cc)
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
        this.lastSingleQuoteOffset = this.pos
        this.returnStates.push(this.state!)
        this.state = this.singleQuotedState
        break
      case '"':
        this.quotingStack.push(this.pos)
        this.returnStates.push(this.state!)
        this.state = this.doubleQuotedState
        break
      case '$':
        this.returnStates.push(this.state!)
        this.state = this.dollarState
        break
      case '`':
        throw ParseError.in(this.src, this.pos, 'Unsupported command expansion')
      case '|': case '&': case ';': case '<': case '>': case '(': case ')':
        throw ParseError.in(this.src, this.pos, `Unescaped special shell character "${cc}"`)
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
        throw this.unterminatedSingleQuotedString()
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
        throw this.unterminatedDoubleQuotedString()
      case '`':
        throw ParseError.in(this.src, this.pos, 'Unsupported command expansion')
      case '"':
        this.quotingStack.pop()
        this.state = this.returnStates.pop()!
        break
      case '\\':
        this.state = this.doubleQuotedEscapeState
        break
      case '$':
        this.returnStates.push(this.state!)
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
        throw this.unterminatedDoubleQuotedString()
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
        throw ParseError.in(this.src, this.pos - 1, `Unsupported special shell parameter \$${cc}`)
      case '(':
        throw ParseError.in(this.src, this.pos - 1, 'Unsupported command or arithmetic expansion')
      case '{':
        this.expansionStack.push(this.pos)
        yield* this.flushTheTemporaryBuffer()
        this.state = this.complexExpansionStartState
        break
      default: {
        IDENT_RX.lastIndex = this.pos
        const m = IDENT_RX.exec(this.input)
        if (m) {
          yield* this.flushTheTemporaryBuffer()
          // simple expansion state
          yield new Token(TokenKind.SimpleExpansion, m[0], this.pos - 1)
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
        throw ParseError.in(this.src, this.pos - 2, `Unsupported special shell parameter \${${cc}}`)
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
        this.expansionStack.pop()
        yield* this.flushTheTemporaryBuffer(TokenKind.SimpleExpansion, -1)
        this.state = this.returnStates.pop()!
        break
      default: {
        OPERATOR_RX.lastIndex = this.pos
        const m = OPERATOR_RX.exec(this.input)
        if (m) {
          yield* this.flushTheTemporaryBuffer(TokenKind.StartExpansion, -1)
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
        throw this.unterminatedExpansion()
      case '`':
        throw ParseError.in(this.src, this.pos, 'Unsupported command expansion')
      case '}':
        this.expansionStack.pop()
        yield* this.flushTheTemporaryBuffer()
        yield new Token(TokenKind.EndExpansion, '}', this.pos)
        this.state = this.returnStates.pop()!
        break
      case '\\':
        this.state = this.expansionValueEscapeState
        break
      case '$':
        this.returnStates.push(this.state!)
        this.state = this.dollarState
        break
      case '"':
        this.quotingStack.push(this.pos)
        this.returnStates.push(this.state!)
        this.state = this.doubleQuotedState
        break
      case "'":
        if (this.quotingStack.length) {
          this.buffer += cc
        } else {
          this.lastSingleQuoteOffset = this.pos
          this.returnStates.push(this.state!)
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
        throw this.unterminatedExpansion()
      case '\n':
        this.state = this.expansionValueState
        break
      case '"': case '$': case '`': case '\\':
        this.buffer += cc
        this.state = this.expansionValueState
        break
      default:
        if (this.quotingStack.length) {
          this.buffer += '\\'
        }
        this.buffer += cc
        this.state = this.expansionValueState
        break
    }
  }
}
