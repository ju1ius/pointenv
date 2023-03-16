import {ParseError} from '../../errors.js'
import {Source} from '../../source.js'

export const enum TokenKind {
  EOF,
  Characters,
  Assign,
  SimpleExpansion,
  StartExpansion,
  ExpansionOperator,
  EndExpansion,
}

export class Token {
  constructor(
    public readonly kind: TokenKind,
    public readonly value: string,
    public readonly offset: number,
  ) {}
}

const KIND_NAMES = {
  [TokenKind.EOF]: 'EOF',
  [TokenKind.Characters]: 'Characters',
  [TokenKind.Assign]: 'Assign',
  [TokenKind.SimpleExpansion]: 'SimpleExpansion',
  [TokenKind.StartExpansion]: 'StartExpansion',
  [TokenKind.ExpansionOperator]: 'ExpansionOperator',
  [TokenKind.EndExpansion]: 'EndExpansion',
} as const

export const kindName = (kind: TokenKind) => KIND_NAMES[kind]
export const tokenName = (token: Token) => KIND_NAMES[token.kind]

export type TokenStream = IterableIterator<Token>

export interface ITokenizer {
  tokenize(src: Source): TokenStream
}

export type State = () => Iterable<Token>

export const COMMENT_RX = /[^\n]*/y
export const WS_RX = /[ \t]+/y
export const WSNL_RX = /[ \t\n]+/y
export const IDENT_RX = /[a-zA-Z_][a-zA-Z0-9_]*/y
export const OPERATOR_RX = /:?[?=+-]/y


export abstract class Tokenizer implements ITokenizer {
  protected src: Source
  protected input: string
  protected pos: number
  protected state: State | null = null
  protected returnStates: State[]
  protected buffer: string
  protected bufferPos: number
  // error position tracking
  protected lastSingleQuoteOffset: number
  protected quotingStack: number[]
  protected expansionStack: number[]

  *tokenize(src: Source) {
    this.src = src
    this.input = src.bytes
    this.pos = -1
    this.state = this.assignmentListState
    this.returnStates = []
    this.buffer = ''
    this.bufferPos = 0
    this.lastSingleQuoteOffset = 0
    this.quotingStack = []
    this.expansionStack = []

    do {
      yield* this.state()
    } while (this.state)
  }

  protected abstract assignmentListState(): Iterable<Token>

  protected * commentState() {
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

  protected eof() {
    this.state = null
    return new Token(TokenKind.EOF, '', this.pos)
  }

  protected * flushTheTemporaryBuffer(kind: TokenKind = TokenKind.Characters, offset = 0) {
    if (this.buffer.length) {
      yield new Token(kind, this.buffer, this.bufferPos + offset)
    }
    this.buffer = ''
    this.bufferPos = this.pos
  }

  protected consumeTheNextCharacter() {
    return this.input.charAt(++this.pos)
  }

  protected reconsumeIn(state: State) {
    --this.pos
    this.state = state
  }

  protected unexpectedChar(cc: string) {
    if (cc === '') {
      return ParseError.in(this.src, this.pos, 'Unexpected end of input')
    }
    return ParseError.in(this.src, this.pos, `Unexpected character "${cc}"`)
  }

  protected unterminatedSingleQuotedString() {
    return ParseError.in(this.src, this.lastSingleQuoteOffset, 'Unterminated single-quoted string')
  }

  protected unterminatedDoubleQuotedString() {
    const offset = this.quotingStack.pop()!
    return ParseError.in(this.src, offset, 'Unterminated double-quoted string')
  }

  protected unterminatedExpansion() {
    const offset = this.expansionStack.pop()!
    return ParseError.in(this.src, offset, 'Unterminated expansion')
  }
}
