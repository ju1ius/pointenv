import {ParseError} from './errors.js'
import {Assignment, CompositeValue, RawValue, Reference, Expression, AssignmentList} from './ast.js'
import {kindName, Token, Tokenizer, TokenKind, tokenName} from './tokenize.js'

export default (input: string) => {
  const parser = new Parser(new Tokenizer(input))
  return parser.parse()
}

export class Parser {

  private token: Token = new Token(TokenKind.EOF, '', 0)

  constructor(
    private readonly tokenizer: Tokenizer
  ) {
  }

  parse() {
    return this.parseAssignmentList()
  }

  private parseAssignmentList() {
    const nodes: Assignment[] = []
    this.skipWhitespaceAndComments()
    while (this.current().kind !== TokenKind.EOF) {
      nodes.push(this.parseAssignment())
      this.skipWhitespaceAndComments()
    }

    return new AssignmentList(nodes)
  }

  private parseAssignment() {
    const name = this.expect(TokenKind.Identifier)
    this.expect(TokenKind.Equal)
    const token = this.current()
    switch (token.kind) {
      case TokenKind.Whitespace:
        throw new ParseError(`Whitespace after equal sign in assignment`)
      case TokenKind.Newline:
      case TokenKind.EOF:
        return new Assignment(name.value, null)
      case TokenKind.SingleQuote: {
        const value = this.parseSingleQuotedString()
        return new Assignment(name.value, value)
      }
      case TokenKind.DoubleQuote: {
        const value = this.parseDoubleQuotedString()
        return new Assignment(name.value, value)
      }
      default: {
        const value = this.parseUnquotedString()
        return new Assignment(name.value, value)
      }
    }
  }

  private parseSingleQuotedString() {
    this.expect(TokenKind.SingleQuote)
    let value = ''
    while (true) {
      const token = this.current()
      switch (token.kind) {
        case TokenKind.EOF:
          throw new ParseError(`Unterminated single-quoted string.`)
        case TokenKind.SingleQuote:
          this.consume()
          return new RawValue(value)
        default:
          this.consume()
          value += token.value
          break
      }
    }
  }

  private parseDoubleQuotedString() {
    this.expect(TokenKind.DoubleQuote)
    const nodes: Expression[] = []
    while (true) {
      const token = this.current()
      switch (token.kind) {
        case TokenKind.EOF:
          throw new ParseError(`Unterminated double-quoted string.`)
        case TokenKind.DoubleQuote:
          this.consume()
          return new CompositeValue(nodes)
        case TokenKind.Dollar:
          nodes.push(this.parseReference())
          break
        default: {
          const value = this.accumulateUntil(TokenKind.Dollar, TokenKind.DoubleQuote)
          nodes.push(new RawValue(value))
          break
        }
      }
    }
  }

  private parseUnquotedString() {
    const nodes: Expression[] = []
    while (true) {
      const token = this.current()
      switch (token.kind) {
        case TokenKind.EOF:
        case TokenKind.Newline:
        case TokenKind.Whitespace:
          return new CompositeValue(nodes)
        case TokenKind.SingleQuote:
          nodes.push(this.parseSingleQuotedString())
          break
        case TokenKind.DoubleQuote:
          nodes.push(this.parseDoubleQuotedString())
          break
        case TokenKind.Dollar:
          nodes.push(this.parseReference())
          break
        default: {
          const value = this.accumulateUntil(
            TokenKind.Newline,
            TokenKind.Whitespace,
            TokenKind.Dollar,
            TokenKind.DoubleQuote,
            TokenKind.SingleQuote
          )
          nodes.push(new RawValue(value))
          break
        }
      }
    }
  }

  private parseReference() {
    this.expect(TokenKind.Dollar)
    let token = this.expect(TokenKind.Identifier, TokenKind.OpenBrace)
    if (token.kind === TokenKind.Identifier) {
      return new Reference(token.value)
    }
    const id = this.expect(TokenKind.Identifier).value
    if (this.current().kind === TokenKind.CloseBrace) {
      this.consume()
      return new Reference(id)
    }
    let op = ''
    if (this.current().kind === TokenKind.Colon) {
      op = ':'
      this.consume()
    }
    op += this.expect(TokenKind.Minus, TokenKind.Equal, TokenKind.Plus, TokenKind.QuestionMark).value
    const rhs = this.parseDefaultExpression()
    return new Reference(id, op, rhs)
  }

  private parseDefaultExpression() {
    const nodes: Expression[] = []
    while (true) {
      const token = this.current()
      switch (token.kind) {
        case TokenKind.EOF:
          this.unexpected(token)
        case TokenKind.SingleQuote:
          nodes.push(this.parseSingleQuotedString())
          break
        case TokenKind.DoubleQuote:
          nodes.push(this.parseDoubleQuotedString())
          break
        case TokenKind.Dollar:
          nodes.push(this.parseReference())
          break
        case TokenKind.CloseBrace:
          this.consume()
          return new CompositeValue(nodes)
        default: {
          const value = this.accumulateUntil(
            TokenKind.Dollar,
            TokenKind.DoubleQuote,
            TokenKind.SingleQuote,
            TokenKind.CloseBrace,
          )
          nodes.push(new RawValue(value))
          break
        }
      }
    }
  }

  private skipWhitespaceAndComments() {
    this.token = this.tokenizer.skipWhitespaceAndComments()
  }

  private accumulateUntil(...until: TokenKind[]) {
    let value = ''
    while (true) {
      const token = this.current()
      if (token.kind === TokenKind.EOF) {
        return value
      }
      if (until.some(kind => token.kind === kind)) {
        return value
      }
      this.consume()
      value += token.value
    }
  }

  private current(): Token {
    return this.token
  }

  private consume() {
    this.token = this.tokenizer.next()
  }

  private expect(...kinds: TokenKind[]) {
    const token = this.current()

    if (!kinds.some(kind => token.kind === kind)) {
      this.unexpected(token, ...kinds)
    }

    this.consume()

    return token
  }

  private unexpected(token: Token, ...expectedKinds: TokenKind[]): never {
    const name = tokenName(token)
    const expected = expectedKinds.map(kindName).join(', ')
    throw new ParseError(`Unexpected token ${name}, expected one of: ${expected}`)
  }
}
