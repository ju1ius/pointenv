import {Parser} from './common.js'
import {ParseError} from '../errors.js'
import {isAlnum, isAlpha, State, Token, TokenKind} from '../tokenizer.js'


export default (input: string) => {
  return new Parser(new Tokenizer(input)).parse()
}

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
      case ' ': case "\t": case "\n":
        // TODO: optimize this
        break
      case '#':
        // TODO: optimize this
        this.state = this.commentState
        break
      default:
        if (cc === '_' || isAlpha(cc)) {
          // TODO: optimize this
          this.buffer += cc
          this.state = this.assignmentNameState
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
      default:
        break
    }
  }

  private *assignmentNameState() {
    const cc = this.consumeTheNextCharacter()
    switch (cc) {
      case '=':
        yield* this.flushTheTemporaryBuffer(TokenKind.Assign)
        this.state = this.assignmentValueState
        break
      default:
        if (cc === '_' || isAlnum(cc)) {
          this.buffer += cc
          break
        }
        throw this.unexpectedChar(cc)
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
      default:
        // TODO: optimize this
        this.buffer += cc
        break
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
      default:
        this.buffer += cc
        break
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
      default:
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
    switch (cc) {
      case '0': case '1': case '2': case '3': case '4': case '5': case '6': case '7': case '8': case '9':
      case '@': case '*': case '#': case '?': case '$': case '!': case '-':
        throw new ParseError(`Unsupported special shell parameter \${${cc}} at offset ${this.pos}`)
      default:
        if (cc === '_' || isAlpha(cc)) {
          this.buffer += cc
          this.state = this.complexExpansionState
          break
        }
        throw this.unexpectedChar(cc)
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
      default:
        this.buffer += cc
        break
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
