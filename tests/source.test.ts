import { assert } from './deps.ts'

import { Source } from '../src/source.ts'

const { assertEquals } = assert

Deno.test('Source.positionAt', async (t) => {
  for (
    const data of [
      {
        desc: 'offset in single line input',
        input: 'abc',
        offset: 1,
        expected: { line: 1, column: 2 },
      },
      {
        desc: 'offset in multi-line input',
        input: 'a\nb\nc',
        offset: 4,
        expected: { line: 3, column: 1 },
      },
      {
        desc: 'offset at newline',
        input: 'a\nb\nc',
        offset: 3,
        expected: { line: 2, column: 2 },
      },
    ]
  ) {
    await t.step(data.desc, () => {
      const src = new Source(data.input)
      assertEquals(src.positionAt(data.offset), data.expected)
    })
  }
})
