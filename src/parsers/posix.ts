import {ParseError} from '../errors.js'
import {Assignment, CompositeValue, RawValue, SimpleReference, Expression, ComplexReference} from '../ast.js'
import {Tokenizer, TokenKind} from '../tokenize.js'
import {Parser} from './common.js'

export default (input: string) => {
  const parser = new PosixParser(new Tokenizer(input))
  return parser.parse()
}

class PosixParser extends Parser {

  constructor(tokenizer: Tokenizer) {
    super(tokenizer)
  }

  protected parseAssignment() {
    const name = this.skipExportStatement()
    this.expect(TokenKind.Equal)
    const token = this.current()
    switch (token.kind) {
      case TokenKind.Whitespace:
        throw new ParseError(`Whitespace after equal sign in assignment on line ${token.line}, column: ${token.col}`)
      case TokenKind.Newline:
      case TokenKind.EOF:
        return new Assignment(name.value, null)
      default: {
        const value = this.parseAssignmentValue()
        return new Assignment(name.value, value)
      }
    }
  }

  protected parseAssignmentValue() {
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
        case TokenKind.Escaped: {
          // https://pubs.opengroup.org/onlinepubs/9699919799/utilities/V3_chap02.html#tag_18_02_01
          if (token.value !== '\n') {
            nodes.push(new RawValue(token.value))
          }
          this.consume()
          break
        }
        default: {
          const value = this.accumulateUntil(
            TokenKind.Newline,
            TokenKind.Whitespace,
            TokenKind.Dollar,
            TokenKind.DoubleQuote,
            TokenKind.SingleQuote,
            TokenKind.Escaped,
          )
          nodes.push(new RawValue(value))
          break
        }
      }
    }
  }

  /**
   * @link https://pubs.opengroup.org/onlinepubs/9699919799/utilities/V3_chap02.html#tag_18_02_02
   */
  protected parseSingleQuotedString() {
    const start = this.expect(TokenKind.SingleQuote)
    let value = ''
    while (true) {
      const token = this.current()
      switch (token.kind) {
        case TokenKind.EOF:
          throw new ParseError(`Unterminated single-quoted string on line ${start.line}, column ${start.col}.`)
        case TokenKind.SingleQuote:
          this.consume()
          return new RawValue(value)
        case TokenKind.Escaped: {
          this.consume()
          if (token.value === "'") {
            value += '\\'
            return new RawValue(value)
          }
          value += `\\${token.value}`
          break
        }
        default:
          this.consume()
          value += token.value
          break
      }
    }
  }

  /**
   * @link https://pubs.opengroup.org/onlinepubs/9699919799/utilities/V3_chap02.html#tag_18_02_03
   */
  protected parseDoubleQuotedString() {
    const start = this.expect(TokenKind.DoubleQuote)
    const nodes: Expression[] = []
    while (true) {
      const token = this.current()
      switch (token.kind) {
        case TokenKind.EOF:
          throw new ParseError(`Unterminated double-quoted string on line ${start.line}, column ${start.col}.`)
        case TokenKind.DoubleQuote:
          this.consume()
          return new CompositeValue(nodes)
        case TokenKind.Dollar: {
          switch (this.peek().kind) {
            case TokenKind.Identifier:
            case TokenKind.OpenBrace:
              nodes.push(this.parseReference())
              break
            default:
              this.consume()
              nodes.push(new RawValue('$'))
              break
          }
          break
        }
        case TokenKind.Escaped:
          this.consume()
          switch (token.value) {
            case '\n':
              break
            case '"':
            case '$':
            case '\\':
              nodes.push(new RawValue(token.value))
              break
            default:
              nodes.push(new RawValue(`\\${token.value}`))
              break
          }
          break
        default: {
          const value = this.accumulateUntil(TokenKind.Dollar, TokenKind.DoubleQuote, TokenKind.Escaped)
          nodes.push(new RawValue(value))
          break
        }
      }
    }
  }

  protected parseReference() {
    this.expect(TokenKind.Dollar)
    let token = this.expectSome(TokenKind.Identifier, TokenKind.OpenBrace)
    if (token.kind === TokenKind.Identifier) {
      return new SimpleReference(token.value)
    }
    const id = this.expect(TokenKind.Identifier).value
    if (this.current().kind === TokenKind.CloseBrace) {
      this.consume()
      return new SimpleReference(id)
    }
    const op = this.parseExpansionOperator()
    const rhs = this.parseDefaultExpression()
    return new ComplexReference(id, op, rhs)
  }

  protected parseDefaultExpression() {
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
}
