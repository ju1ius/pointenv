import {ParseError} from '../errors.js'
import {Assignment, AssignmentList, Operator} from '../ast.js'
import {kindName, Token, Tokenizer, TokenKind, tokenName} from '../tokenize.js'


export abstract class Parser {

  private bufferSize = 2
  private buffer: Token[] = []
  private bufferPos = 0

  private lastAssignmentLine: number | null = null
  private lastExportLine: number | null = null

  constructor(
    protected readonly tokenizer: Tokenizer
  ) {
  }

  parse() {
    this.fillBuffer()
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

  protected abstract parseAssignment(): Assignment

  protected parseExpansionOperator() {
    let op = ''
    if (this.current().kind === TokenKind.Colon) {
      op = ':'
      this.consume()
    }
    op += this.expectSome(TokenKind.Minus, TokenKind.Equal, TokenKind.Plus, TokenKind.QuestionMark).value
    return op as Operator
  }

  protected skipWhitespaceAndComments() {
    while (true) {
      const token = this.current()
      switch (token.kind) {
        case TokenKind.Whitespace:
        case TokenKind.Newline:
          this.consume()
          break
        case TokenKind.Hash:
          this.skipUntil(TokenKind.Newline)
          break
        default:
          return
      }
    }
  }

  protected skipWhitespace() {
    while (this.current().kind === TokenKind.Whitespace) {
      this.consume()
    }
    return this.current()
  }

  protected skipExportStatement() {
    let name = this.expect(TokenKind.Identifier)
    if (name.value.toLowerCase() === 'export') {
      if (this.lastExportLine === name.line) {
        throw new ParseError(`Multiple export statements on line ${name.line}`)
      }
      if (this.lastAssignmentLine === name.line) {
        throw new ParseError(`Export statement must precede assignments on line ${name.line}`)
      }
      this.lastExportLine = name.line
      this.expect(TokenKind.Whitespace)
      name = this.expect(TokenKind.Identifier)
    }
    this.lastAssignmentLine = name.line
    return name
  }

  protected accumulateUntil(...until: TokenKind[]) {
    let value = ''
    while (true) {
      const token = this.current()
      if (token.isOneOf(TokenKind.EOF, ...until)) {
        return value
      }
      this.consume()
      value += token.value
    }
  }

  protected skipUntil(...until: TokenKind[]) {
    while (true) {
      const token = this.current()
      if (token.isOneOf(TokenKind.EOF, ...until)) {
        return
      }
      this.consume()
    }
  }

  protected current(): Token {
    return this.buffer[this.bufferPos]
  }

  protected peek(): Token {
    const p = (this.bufferPos + 1) % this.bufferSize
    return this.buffer[p]
  }

  protected consume() {
    this.buffer[this.bufferPos] = this.tokenizer.next()
    this.bufferPos = (this.bufferPos + 1) % this.bufferSize
  }

  protected expect(kind: TokenKind) {
    const token = this.current()
    if (token.kind !== kind) {
      this.unexpected(token, kind)
    }
    this.consume()
    return token
  }

  protected expectSome(...kinds: TokenKind[]) {
    const token = this.current()
    if (!token.isOneOf(...kinds)) {
      this.unexpected(token, ...kinds)
    }
    this.consume()
    return token
  }

  protected unexpected(token: Token, ...expectedKinds: TokenKind[]): never {
    const name = tokenName(token)
    const {line, col} = token
    const expected = expectedKinds.map(kindName).join(', ')
    throw new ParseError(`Unexpected token ${name}@${line}:${col}, expected: ${expected}`)
  }

  private fillBuffer() {
    this.buffer = []
    this.bufferPos = 0
    for (let i = 0; i < this.bufferSize; i++) {
      this.consume()
    }
  }
}
