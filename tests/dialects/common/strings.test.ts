import {Dialect, getParser} from '../../../src/dialects.js'
import {ParseError} from '../../../src/errors.js'
import {assertEval, TestCase} from '../utils.js'

const dialects = [
  Dialect.Posix,
  Dialect.Compose,
  Dialect.Symfony,
]

describe.each(dialects)('%p strings', (dialect) => {
  test.each<TestCase>([
    {
      desc: 'unterminated single-quoted string',
      input: `foo='bar`,
      error: ParseError,
    },
    {
      desc: 'unterminated double-quoted string',
      input: `foo="bar`,
      error: ParseError,
    },
  ])('$desc', async (data) => {
    const parser = await getParser(dialect)
    assertEval(data, parser)
  })
})
