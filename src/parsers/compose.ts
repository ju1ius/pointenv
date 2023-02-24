import {Assignment, ComplexReference, CompositeValue, Expression, RawValue, SimpleReference} from '../ast.js'
import {ParseError} from '../errors.js'
import {Tokenizer, TokenKind} from '../tokenize.js'
import {Parser} from './common.js'

export default (input: string) => {
  const parser = new DockerParser(new Tokenizer(input))
  return parser.parse()
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

class DockerParser extends Parser {

  constructor(tokenizer: Tokenizer) {
    super(tokenizer)
  }

  protected parseAssignment() {
    const name = this.skipExportStatement()
    this.skipWhitespace()
    this.expect(TokenKind.Equal)
    const token = this.skipWhitespace()
    switch (token.kind) {
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
    const token = this.current()
    switch (token.kind) {
      case TokenKind.SingleQuote:
        nodes.push(this.parseSingleQuotedString())
        break
      case TokenKind.DoubleQuote:
        nodes.push(this.parseDoubleQuotedString())
        break
      default: {
        nodes.push(this.parseUnquotedString())
        break
      }
    }
    this.skipWhitespace()
    return new CompositeValue(nodes)
  }

  private parseUnquotedString() {
    const nodes: Expression[] = []
    while (true) {
      const token = this.current()
      switch (token.kind) {
        case TokenKind.EOF:
        case TokenKind.Newline:
          return new CompositeValue(nodes)
        case TokenKind.Whitespace: {
          const next = this.peek()
          switch (next.kind) {
            case TokenKind.Hash:
            case TokenKind.Newline:
            case TokenKind.EOF:
              return new CompositeValue(nodes)
            default:
              this.consume()
              nodes.push(new RawValue(token.value))
              break
          }
          break
        }
        case TokenKind.Dollar:
          this.consume()
          nodes.push(this.parsePossibleReference())
          break
        case TokenKind.Escaped:
          this.consume()
          switch (token.value) {
            case '\n':
              nodes.push(new RawValue('\\'))
              return new CompositeValue(nodes)
            case '$':
              nodes.push(new RawValue('\\'))
              nodes.push(this.parsePossibleReference())
              break
            default:
              nodes.push(new RawValue(`\\${token.value}`))
              break
          }
          break
        default: {
          const value = this.accumulateUntil(
            TokenKind.EOF,
            TokenKind.Newline,
            TokenKind.Whitespace,
            TokenKind.Dollar,
            TokenKind.Escaped,
          )
          nodes.push(new RawValue(value))
          break
        }
      }
    }
  }

  protected parseSingleQuotedString() {
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
        case TokenKind.Escaped: {
          this.consume()
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

  protected parseDoubleQuotedString() {
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
          this.consume()
          nodes.push(this.parsePossibleReference(true))
          break
        case TokenKind.Escaped: {
          this.consume()
          let value = DQUOTED_ESCAPES.get(token.value)
          if (value) {
            nodes.push(new RawValue(value))
          } else {
            nodes.push(new RawValue(`\\${token.value}`))
          }
          break
        }
        default: {
          const value = this.accumulateUntil(TokenKind.Dollar, TokenKind.DoubleQuote, TokenKind.Escaped)
          nodes.push(new RawValue(value))
          break
        }
      }
    }
  }

  protected parsePossibleReference(quoted = false) {
    let token = this.current()
    if (!token.isOneOf(TokenKind.Identifier, TokenKind.OpenBrace)) {
      return new RawValue('$')
    }
    if (token.kind === TokenKind.Identifier) {
      this.consume()
      return new SimpleReference(token.value)
    }
    this.consume()
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
        case TokenKind.Dollar:
          this.consume()
          nodes.push(this.parsePossibleReference())
          break
        case TokenKind.CloseBrace:
          this.consume()
          return new CompositeValue(nodes)
        default: {
          const value = this.accumulateUntil(
            TokenKind.Dollar,
            TokenKind.CloseBrace,
          )
          nodes.push(new RawValue(value))
          break
        }
      }
    }
  }
}

