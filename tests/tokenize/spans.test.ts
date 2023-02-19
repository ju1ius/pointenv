import {Token, Tokenizer, TokenKind} from '../../src/tokenize'
import {tokenize} from './utils'

test.each([
  {
    input: 'a\nb',
    expected: [
      new Token(TokenKind.Identifier, 'a', 1, 1),
      new Token(TokenKind.Newline, '\n', 1, 2),
      new Token(TokenKind.Identifier, 'b', 2, 1),
      new Token(TokenKind.EOF, '', 2, 2),
    ],
  },
  {
    input: '  a\n  b',
    expected: [
      new Token(TokenKind.Whitespace, '  ', 1, 1),
      new Token(TokenKind.Identifier, 'a', 1, 3),
      new Token(TokenKind.Newline, '\n', 1, 4),
      new Token(TokenKind.Whitespace, '  ', 2, 1),
      new Token(TokenKind.Identifier, 'b', 2, 3),
      new Token(TokenKind.EOF, '', 2, 4),
    ],
  },
])('tracks line numbers', ({input, expected}) => {
  const tokens = tokenize(input)
  expect(tokens).toEqual(expected)
})

test('tracks line while skipping ws/comments', () => {
  const input = `\
#0
a
#1
b #2
c
#3`
  const tokenizer = new Tokenizer(input)
  const tokens: Token[] = []
  while (true) {
    const token = tokenizer.skipWhitespaceAndComments()
    tokens.push(token)
    if (token.kind === TokenKind.EOF) break
    tokenizer.advance()
  }
  const expected = [
    new Token(TokenKind.Identifier, 'a', 2, 1),
    new Token(TokenKind.Identifier, 'b', 4, 1),
    new Token(TokenKind.Identifier, 'c', 5, 1),
    new Token(TokenKind.EOF, '', 6, 3),
  ]
  expect(tokens).toEqual(expected)
})
