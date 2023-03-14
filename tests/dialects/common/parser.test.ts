import {Parser} from '../../../src/dialects/common.js'
import {ParseError} from '../../../src/errors.js'
import {Token, TokenKind} from '../../../src/tokenizer.js'

class MockTokenizer {
  constructor(
    private readonly tokens: Token[]
  ) {}
  *tokenize() {
    yield* this.tokens
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
    const parser = new Parser(new MockTokenizer(input))
    expect(() => {
      parser.parse()
    }).toThrow(expected)
  })
})
