import {Assignment, CompositeValue, Expression, RawValue} from '../ast.js'
import {ParseError} from '../errors.js'
import {Tokenizer, TokenKind} from '../tokenize.js'
import {PosixParser} from './posix.js'


export default (input: string) => {
  const parser = new SymfonyParser(new Tokenizer(preprocess(input)))
  return parser.parse()
}

const ANYCRLF_RX = /\r\n|\r/g

const UNQUOTED_ESCAPES = new Map<string, string>([
  ['"', '"'],
  ["'", "'"],
  ['$', '$'],
  ['\\', '\\'],
])
const DQUOTED_ESCAPES = new Map<string, string>([
  ['"', '"'],
  ['r', '\r'],
  ['n', '\n'],
  ['\\', '\\'],
  ['$', '$'],
])

const preprocess = (input: string) => {
  return input.replace(ANYCRLF_RX, '\n')
}

class SymfonyParser extends PosixParser {
  constructor(tokenizer: Tokenizer) {
    super(tokenizer)
  }

  protected parseAssignment() {
    const name = this.skipExportStatement()
    this.expect(TokenKind.Equal)
    const token = this.current()
    switch (token.kind) {
      case TokenKind.Whitespace: {
        const next = this.peek()
        switch (next.kind) {
          case TokenKind.Newline:
          case TokenKind.Hash:
          case TokenKind.EOF:
            return new Assignment(name.value, null)
          default:
            throw new ParseError(`Whitespace after equal sign in assignment on line ${token.line}, column: ${token.col}`)
        }
      }
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
          nodes.push(this.parsePossibleReference())
          break
        case TokenKind.Escaped: {
          if (token.value === '\n') {
            this.unexpected(token)
          }
          this.consume()
          let value = UNQUOTED_ESCAPES.get(token.value)
          if (value) {
            nodes.push(new RawValue(value))
          } else {
            nodes.push(new RawValue(`\\${token.value}`))
          }
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
}
