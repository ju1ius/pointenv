import { assert } from '../../deps.ts'
const { assertEquals } = assert

import { json } from '../../resources.ts'

import evaluate from '../../../src/evaluate.ts'
import parse from '../../../src/dialects/posix.ts'
import { Source } from '../../../src/source.ts'

Deno.test('shell compatibility', async (t) => {
  type TestCase = {
    desc: string
    setup?: string
    input: string
    expected: string
  }
  const cases = json<TestCase[]>('posix/shell-exprs.json')
  for (const { desc, setup = '', input, expected } of cases) {
    await t.step(desc, () => {
      const src = new Source(`${setup}\n__TEST_EXPR__=${input}`)
      const result = evaluate(parse(src))
      assertEquals(
        result,
        new Map([
          ['__TEST_EXPR__', expected],
        ]),
      )
    })
  }
})
