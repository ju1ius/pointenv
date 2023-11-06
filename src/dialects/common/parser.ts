
import {Assignment, Expansion, type Operator, type Expression} from './ast.ts'
import {ParseError} from '../../errors.ts'
import {type ITokenizer, kindName, Token, TokenKind, tokenName, type TokenStream} from './tokenizer.ts'
import type {Source} from '../../source.ts'

export class Parser {
  private src: Source
  private tokens: TokenStream
  private current: Token

  constructor(
    private readonly tokenizer: ITokenizer
  ) {
  }

  parse(src: Source) {
    this.src = src
    this.tokens = this.tokenizer.tokenize(src)
    const nodes = []
    this.consumeTheNextToken()
    while (true) {
      switch (this.current.kind) {
        case TokenKind.EOF:
          return nodes
        case TokenKind.Assign:
          nodes.push(this.parseAssignment())
          break
        default:
          throw this.unexpected(this.current, TokenKind.Assign, TokenKind.EOF)
      }
    }
  }

  private parseAssignment() {
    const name = this.current.value
    const value = this.parseAssignmentValue()
    return new Assignment(name, value)
  }

  private parseAssignmentValue() {
    const nodes: Expression[] = []
    while (true) {
      this.consumeTheNextToken()
      switch (this.current.kind) {
        case TokenKind.Assign:
        case TokenKind.EOF:
          return nodes
        case TokenKind.Characters:
          nodes.push(this.current.value)
          break
        case TokenKind.SimpleExpansion:
          nodes.push(new Expansion(this.current.value))
          break
        case TokenKind.StartExpansion: {
          const name = this.current.value
          const operator = this.parseExpansionOperator()
          const value = this.parseExpansionValue()
          nodes.push(new Expansion(name, operator, value))
          break
        }
        default:
          throw this.unexpected(
            this.current,
            TokenKind.Characters,
            TokenKind.SimpleExpansion,
            TokenKind.StartExpansion,
            TokenKind.Assign,
            TokenKind.EOF,
          )
      }
    }
  }

  private parseExpansionOperator() {
    this.consumeTheNextToken()
    switch (this.current.kind) {
      case TokenKind.ExpansionOperator:
        return this.current.value as Operator
      default:
        throw this.unexpected(this.current, TokenKind.ExpansionOperator)
    }
  }

  private parseExpansionValue() {
    const nodes: Expression[] = []
    while (true) {
      this.consumeTheNextToken()
      switch (this.current.kind) {
        case TokenKind.EndExpansion:
          return nodes
        case TokenKind.Characters:
          nodes.push(this.current.value)
          break
        case TokenKind.SimpleExpansion:
          nodes.push(new Expansion(this.current.value, '-', []))
          break
        case TokenKind.StartExpansion: {
          const name = this.current.value
          const operator = this.parseExpansionOperator()
          const value = this.parseExpansionValue()
          nodes.push(new Expansion(name, operator, value))
          break
        }
        default:
          throw this.unexpected(
            this.current,
            TokenKind.EndExpansion,
            TokenKind.Characters,
            TokenKind.SimpleExpansion,
            TokenKind.StartExpansion,
          )
      }
    }
  }

  private consumeTheNextToken() {
    const {value, done} = this.tokens.next()
    if (done) return
    this.current = value
    return this.current
  }

  private unexpected(token: Token, ...expected: TokenKind[]) {
    const name = tokenName(token)
    let message = `Unexpected token ${name}`
    if (expected.length) {
      const expectedKinds = expected.map(kindName).join(', ')
      message += `, expected ${expectedKinds}.`
    }
    return ParseError.in(this.src, token.offset, message)
  }
}
