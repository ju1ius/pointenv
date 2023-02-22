import {kindName, Token, Tokenizer, TokenKind, tokenName} from '../src/tokenize.js'


const tokenize = (input: string): Token[] => {
  const tokenizer = new Tokenizer(input)
  const tokens: Token[] = []
  while (true) {
    const token = tokenizer.next()
    tokens.push(token)
    if (token.kind === TokenKind.EOF) break
  }
  return tokens
}

describe('tokenizer', () => {

  it('treats backslash at EOF as character', () => {
    const tokens = tokenize('\\')
    expect(tokens).toEqual([
      new Token(TokenKind.Characters, '\\', 1, 1),
      new Token(TokenKind.EOF, '', 1, 2),
    ])
  })

  it('can pretty print token kinds', () => {
    const token = new Token(TokenKind.Characters, 'zob', 1, 1)
    expect(tokenName(token)).toBe('Characters')
    expect(kindName(token.kind)).toBe('Characters')
  })

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

})

