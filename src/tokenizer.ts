import {ParseError} from './errors.js'

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

export type State = () => Iterable<Token>

export const COMMENT_RX = /[^\n]*/y
export const WS_RX = /[ \t]+/y
export const WSNL_RX = /[ \t\n]+/y
export const IDENT_RX = /[a-zA-Z_][a-zA-Z0-9_]*/y
export const OPERATOR_RX = /:?[?=+-]/y


export interface ITokenizer {
  tokenize(): TokenStream
}

export abstract class Tokenizer implements ITokenizer {
  protected pos: number = -1
  protected state: State | null = null
  protected quotingLevel: number = 0
  protected returnStates: State[] = []
  protected buffer: string = ''

  constructor(
    protected readonly input: string
  ) {}

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

  protected abstract assignmentListState(): Iterable<Token>

  protected *commentState() {
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

  protected *flushTheTemporaryBuffer(kind: TokenKind = TokenKind.Characters) {
    if (this.buffer.length) {
      yield new Token(kind, this.buffer, this.pos)
    }
    this.buffer = ''
  }

  protected consumeTheNextCharacter() {
    return this.input.charAt(++this.pos)
  }

  protected reconsumeIn(state: State) {
    --this.pos
    this.state = state
  }

  protected unexpectedChar(cc: string) {
    const state = this.state?.name
    if (cc === '') {
      return new ParseError(`Unexpected end of input in ${state} at offset ${this.pos}.`)
    }
    return new ParseError(`Unexpected character "${cc}" in ${state} at offset ${this.pos}.`)
  }
}
