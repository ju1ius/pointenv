import {assert, path} from '../deps.ts'
const {assertEquals, assertThrows} = assert
const {basename, dirname} = path

import {filesIn} from '../posix-resources.ts'
import {assertEval, type TestCase} from './utils.ts'

import parse from '../../src/dialects/posix.ts'
import {ParseError, UndefinedVariable} from '../../src/errors.ts'
import {PosixTokenizer} from '../../src/dialects/posix.ts'
import {kindName, Token} from '../../src/dialects/common/tokenizer.ts'
import {Source} from '../../src/source.ts'

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

Deno.test('posix: tokenization', async (t) => {
  for (const {path} of filesIn('tokenization')) {
    const name = basename(path)
    const blob = Deno.readTextFileSync(path)
    const cases = JSON.parse(blob) as TokenizationCase[]
    for (const data of cases) {
      await t.step(`${name} > ${data.desc}`, () => {
        const tokenizer = new PosixTokenizer()
        if ('error' in data) {
          assertThrows(
            () => Array.from(tokenizer.tokenize(new Source(data.input))),
            ParseError,
          )
        } else {
          const tokens = Array.from(tokenizer.tokenize(new Source(data.input)), convertToken)
          assertEquals(tokens, data.expected)
        }
      })
    }
  }
})

Deno.test('posix: evaluation', async (t) => {
  for (const {path} of filesIn('evaluation')) {
    const dir = basename(dirname(path))
    const name = basename(path)
    const blob = Deno.readTextFileSync(path)
    const cases = JSON.parse(blob) as TestCase[]
    for (const data of cases) {
      await t.step(`${dir}/${name} > ${data.desc}`, () => {
        assertEval(convertCase(data), parse)
      })
    }
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
