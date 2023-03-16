import {Parser} from '../../../src/dialects/common/parser.js'
import {Token, TokenKind} from '../../../src/dialects/common/tokenizer.js'
import {ParseError} from '../../../src/errors.js'
import {Source} from '../../../src/source.js'

class MockTokenizer {
  constructor(
    private readonly tokens: Token[]
  ) {}

  *tokenize() {
    yield* this.tokens
  }

  toSource() {
    return new Source(this.tokens.map(t => t.value).join(''))
  }
}

describe('parser', () => {
  test.each([
    {
      desc: 'Unexpected token in top-level',
      input: [
        new Token(TokenKind.Characters, 'foo', 0),
      ],
      expected: ParseError,
    },
    {
      desc: 'Unexpected token in assignment value',
      input: [
        new Token(TokenKind.Assign, 'foo', 0),
        new Token(TokenKind.ExpansionOperator, '*', 3),
      ],
      expected: ParseError,
    },
    {
      desc: 'Unexpected token while parsing expansion operator',
      input: [
        new Token(TokenKind.Assign, 'a', 0),
        new Token(TokenKind.StartExpansion, 'a', 1),
        new Token(TokenKind.EndExpansion, '}', 2),
      ],
      expected: ParseError,
    },
    {
      desc: 'Unexpected token in expansion value',
      input: [
        new Token(TokenKind.Assign, 'a', 0),
        new Token(TokenKind.StartExpansion, 'a', 1),
        new Token(TokenKind.ExpansionOperator, '-', 2),
        new Token(TokenKind.Assign, 'x', 3),
      ],
      expected: ParseError,
    }
  ])('$desc', ({input, expected}) => {
    let tokenizer = new MockTokenizer(input)
    const parser = new Parser(tokenizer)
    expect(() => {
      parser.parse(tokenizer.toSource())
    }).toThrow(expected)
  })
})
