import {assert} from '../../deps.ts'
const {assertThrows} = assert

import {Parser} from '../../../src/dialects/common/parser.ts'
import {Token, TokenKind} from '../../../src/dialects/common/tokenizer.ts'
import {ParseError} from '../../../src/errors.ts'
import {Source} from '../../../src/source.ts'

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

Deno.test('parser', async (t) => {
  for (const {desc, input, expected} of [
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

  ]) {
    await t.step(desc, () => {
      const tokenizer = new MockTokenizer(input)
      const parser = new Parser(tokenizer)
      assertThrows(
        () => parser.parse(tokenizer.toSource()),
        expected
      )
    })
  }
})
