import {Dialect, getParser} from '../../../src/dialects.js'
import {ParseError} from '../../../src/errors.js'
import {assertEval, TestCase} from '../utils.js'

const dialects = [
  Dialect.Posix,
  Dialect.Compose,
  Dialect.Symfony,
]

describe.each(dialects)('%p export', (dialect) => {
  test.each<TestCase>([
    {
      desc: 'valid at start of line',
      input: 'export a="1" b="2"',
      expected: {a: '1', b: '2'},
    },
    {
      desc: 'invalid after an assignment on the same line',
      input: 'a="1" export b="2"',
      error: ParseError,
    },
    {
      desc: 'invalid after another export on the same line',
      input: 'export a="1" export b="2"',
      error: ParseError,
    },
  ])('$desc', async (data) => {
    const parser = await getParser(dialect)
    assertEval(data, parser)
  })
})
