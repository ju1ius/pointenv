import {dirname, basename} from 'node:path'
import {readFileSync} from 'node:fs'
import {glob} from '../posix-resources.js'

import {assertEval, type TestCase} from './utils.js'
import parse from '../../src/dialects/posix.js'
import {ParseError, UndefinedVariable} from '../../src/errors.js'
import {Tokenizer} from '../../src/dialects/posix.js'
import {kindName, Token} from '../../src/tokenizer.js'

type TokenizationBaseCase = {
  desc: string
  input: string
}
type TokenizationSuccess = TokenizationBaseCase & {
  expected: Array<{kind: string, value: string}>
}
type TokenizationError = TokenizationBaseCase & {
  error: string
}
type TokenizationCase = TokenizationSuccess | TokenizationError

describe('posix: tokenization', () => {
  const files = glob('tokenization/**/*.json')
  for (const path of files) {
    const name = basename(path)
    const blob = readFileSync(path, {encoding: 'utf-8'})
    const cases = JSON.parse(blob)
    test.each<TokenizationCase>(cases)(`${name} > $#: $desc`, async (data) => {
      const tokenizer = new Tokenizer(data.input)
      if ('error' in data) {
        expect(() => {
          Array.from(tokenizer.tokenize())
        }).toThrow(ParseError)
      } else {
        const tokens = Array.from(tokenizer.tokenize(), convertToken)
        expect(tokens).toEqual(data.expected)
      }
    })
  }
})

describe('posix: evaluation', () => {
  const files = glob('evaluation/**/*.json')
  for (const path of files) {
    const dir = basename(dirname(path))
    const name = basename(path)
    const blob = readFileSync(path, {encoding: 'utf-8'})
    const cases = JSON.parse(blob)
    test.each<TestCase>(cases)(`${dir}/${name} > $#: $desc`, async (data) => {
      assertEval(convertCase(data), parse)
    })
  }
})

function convertCase(test: TestCase) {
  if ('error' in test) {
    test.error = convertError(test.error as string)
  }
  return test
}

function convertError(error: string) {
  switch (error) {
    case 'UndefinedVariable':
      return UndefinedVariable
    default:
      return ParseError
  }
}

function convertToken(token: Token): {kind: string, value: string} {
  const {kind, value} = token
  return {
    kind: kindName(kind),
    value,
  }
}
