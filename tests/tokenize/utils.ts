import {Token, Tokenizer, TokenKind} from '../../src/tokenize'


export const tokenize = (input: string): Token[] => {
  const tokenizer = new Tokenizer(input)
  const tokens: Token[] = []
  while (true) {
    const token = tokenizer.next()
    tokens.push(token)
    if (token.kind === TokenKind.EOF) break
  }
  return tokens
}
