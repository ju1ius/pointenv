import { assert, path } from '../deps.ts'
const { assertEquals } = assert
const { basename, resolve, dirname } = path

import { filesIn } from '../resources.ts'
import { assertEval } from './utils.ts'

import evaluate from '../../src/evaluate.ts'
import parse from '../../src/dialects/compose.ts'
import { ParseError } from '../../src/errors.ts'
import { Source } from '../../src/source.ts'

const loadCases = () => {
  type DataSet = Array<{ key: string; value: string }>
  return Array.from(
    filesIn('compose', { exts: ['env'] }),
    ({ path }) => {
      const input = Deno.readTextFileSync(path)
      const name = basename(path)
      const outFile = resolve(dirname(path), `${name}.expected.json`)
      const results: DataSet = JSON.parse(Deno.readTextFileSync(outFile))
      const expected = new Map(
        results.map(({ key, value }) => [key, value]),
      )
      return {
        desc: name,
        input,
        expected,
      }
    },
  )
}

Deno.test('compose dialect', async (t) => {
  for (const { desc, input, expected } of loadCases()) {
    await t.step(`file ${desc}`, () => {
      const ast = parse(new Source(input))
      const result = evaluate(ast)
      assertEquals(result, expected)
    })
  }
  for (
    const data of [
      {
        desc: 'eof in assignment-value state',
        input: 'a=',
        expected: { a: '' },
      },
      {
        desc: 'eof after whitespace in unquoted state',
        input: 'a= \t ',
        expected: { a: '' },
      },
      {
        desc: 'unexpected character in assignment-list state',
        input: '$$',
        error: ParseError,
      },
      {
        desc: 'unexpected character in complex-expansion-start state',
        input: 'a=${!}',
        error: ParseError,
      },
      {
        desc: 'unexpected character in complex-expansion state',
        input: 'a=${foo|bar}',
        error: ParseError,
      },
    ]
  ) {
    await t.step(data.desc, () => {
      assertEval(data, parse)
    })
  }
})
