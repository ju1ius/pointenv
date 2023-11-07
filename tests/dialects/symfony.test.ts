import { path } from '../deps.ts'
const { basename } = path

import { filesIn, json } from '../resources.ts'
import { assertEval } from './utils.ts'

import { ParseError } from '../../src/errors.ts'
import parse from '../../src/dialects/symfony.ts'

const loadCases = () => {
  return Array.from(
    filesIn('php/symfony', { exts: ['env'] }),
    ({ path }) => {
      const input = Deno.readTextFileSync(path)
      const name = basename(path)
      const expected = json<Record<string, string>>(`php/symfony/${name}.expected.json`)
      return {
        desc: name,
        input,
        expected,
      }
    },
  )
}

Deno.test('symfony dialect', async (t) => {
  for (const data of loadCases()) {
    await t.step(`file ${data.desc}`, () => {
      assertEval(data, parse)
    })
  }

  const invalidExpansionChars = ['$', '"', '\'', '{'].map((c) => ({
    desc: 'unexpected character in expansion-value state',
    input: `a=\${foo:-${c}}`,
    error: ParseError,
  }))
  for (
    const data of [
      {
        desc: 'unexpected character in assignment-list state',
        input: '$$',
        error: ParseError,
      },
      {
        desc: 'whitespace after = in non-empty assignment',
        input: 'a= 1',
        error: ParseError,
      },
      {
        desc: 'no line continuation support',
        input: 'a=1\\\n2',
        error: ParseError,
      },
      {
        desc: 'unexpected character in complex-expansion state',
        input: 'a=${foo|bar}',
        error: ParseError,
      },
      ...invalidExpansionChars,
    ]
  ) {
    await t.step(data.desc, () => {
      assertEval(data, parse)
    })
  }
})
