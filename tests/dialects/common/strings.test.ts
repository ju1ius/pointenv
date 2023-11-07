import {assertEval} from '../utils.ts'

import {Dialect, getParser} from '../../../src/dialects.ts'
import {ParseError} from '../../../src/errors.ts'

const dialects = [
  Dialect.Posix,
  Dialect.Compose,
  Dialect.Symfony,
]

for (const dialect of dialects) {
  Deno.test(`${dialect} strings`, async (t) => {
    for (const data of [
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
      {
        desc: 'comment at eof',
        input: '# a comment',
        expected: {},
      },
    ]) {
      await t.step(data.desc, async () => {
        const parser = await getParser(dialect)
        assertEval(data, parser)
      })
    }
  })
}
