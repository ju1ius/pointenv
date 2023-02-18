
export const enum TokenKind {
  EOF,
  Characters,
  Escaped,
  Newline,
  Whitespace,
  Identifier,
  Hash,
  Dollar,
  OpenBrace,
  CloseBrace,
  Equal,
  Plus,
  Minus,
  Colon,
  QuestionMark,
  DoubleQuote,
  SingleQuote,
}

const TOKEN_NAMES = {
  [TokenKind.EOF]: 'EOF',
  [TokenKind.Characters]: 'Characters',
  [TokenKind.Escaped]: 'Escaped',
  [TokenKind.Newline]: 'Newline',
  [TokenKind.Whitespace]: 'Whitespace',
  [TokenKind.Identifier]: 'Identifier',
  [TokenKind.Hash]: 'Hash',
  [TokenKind.Dollar]: 'Dollar',
  [TokenKind.OpenBrace]: 'OpenBrace',
  [TokenKind.CloseBrace]: 'CloseBrace',
  [TokenKind.Equal]: 'Equal',
  [TokenKind.Plus]: 'Plus',
  [TokenKind.Minus]: 'Minus',
  [TokenKind.Colon]: 'Colon',
  [TokenKind.QuestionMark]: 'QuestionMark',
  [TokenKind.DoubleQuote]: 'DoubleQuote',
  [TokenKind.SingleQuote]: 'SingleQuote',
} as const

export const kindName = (kind: TokenKind): string => TOKEN_NAMES[kind]
export const tokenName = (tk: Token): string => kindName(tk.kind)

export class Token {
  constructor(
    public readonly kind: TokenKind,
    public readonly value: string,
    public readonly pos: number,
  ) {}
}

const CHAR_TOKENS: Record<string, TokenKind> = {
  '#': TokenKind.Hash,
  '$': TokenKind.Dollar,
  '{': TokenKind.OpenBrace,
  '}': TokenKind.CloseBrace,
  '=': TokenKind.Equal,
  '+': TokenKind.Plus,
  '-': TokenKind.Minus,
  ':': TokenKind.Colon,
  '?': TokenKind.QuestionMark,
  '"': TokenKind.DoubleQuote,
  "'": TokenKind.SingleQuote,
} as const

const IDENT_RX = /[A-Za-z_][0-9A-Za-z_]*/y
const WS_RX = /[ \t\f\r\v]+/y
// This pattern MUST NOT match any character that can start a token
// other than TokenKind.Any
const ANY_RX = /[^\\#\sA-Za-z_${}=+:?"'-]+/y
// skips over comments
const COMMENT_RX = /#[^\n]*(?:\n|$)/y

export class Tokenizer {
  private pos: number = -1
  private end: number

  constructor(
    private readonly input: string
  ) {
    this.end = input.length
  }

  next(): Token {
    let cc = this.input.charAt(++this.pos)
    switch (cc) {
      case '':
        return new Token(TokenKind.EOF, '', this.pos)
      case '\\': {
        let cn = this.input.charAt(this.pos + 1)
        if (cn) {
          return new Token(TokenKind.Escaped, cn, ++this.pos)
        }
        return new Token(TokenKind.Characters, '\\', this.pos)
      }
      case ' ': case '\t': case '\f': case '\r': case '\v': {
        return this.consumeWhitespace()
      }
      case '\n':
        // TODO: track line & column numbers
        return new Token(TokenKind.Newline, '\n', this.pos)
      default: {
        let tt
        if (tt = CHAR_TOKENS[cc]) {
          return new Token(tt, cc, this.pos)
        }
        if (tt = this.matchIdentifier()) {
          return tt
        }
        return this.matchAny()
      }
    }
  }

  skipWhitespaceAndComments() {
    if (this.pos < 0) this.pos = 0
    while (true) {
      let cc = this.input.charAt(this.pos)
      switch (cc) {
        case '#': {
          COMMENT_RX.lastIndex = this.pos
          const m = COMMENT_RX.exec(this.input)!
          this.pos += m[0].length
          break
        }
        case ' ': case '\t': case '\f': case '\r': case '\v': {
          WS_RX.lastIndex = this.pos
          const m = WS_RX.exec(this.input)!
          this.pos += m[0].length
          break
        }
        case '\n': {
          // TODO: track line & column numbers
          ++this.pos
          break
        }
        default: {
          --this.pos
          return this.next()
        }
      }
    }
  }

  private matchIdentifier() {
    IDENT_RX.lastIndex = this.pos
    const m = IDENT_RX.exec(this.input)
    if (!m) return null
    const token = new Token(TokenKind.Identifier, m[0], this.pos)
    this.pos += m[0].length - 1
    return token
  }

  private matchAny() {
    ANY_RX.lastIndex = this.pos
    const m = ANY_RX.exec(this.input)!
    const token = new Token(TokenKind.Characters, m[0], this.pos)
    this.pos += m[0].length - 1
    return token
  }

  private consumeWhitespace() {
    WS_RX.lastIndex = this.pos
    const m = WS_RX.exec(this.input)!
    const token = new Token(TokenKind.Whitespace, m[0], this.pos)
    this.pos += m[0].length - 1
    return token
  }
}
