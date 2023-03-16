import evaluate from '../../../src/evaluate.js'
import parse from '../../../src/dialects/posix.js'
import * as resources from '../../resources.js'
import {Source} from '../../../src/source.js'


describe('shell compatibility', () => {
  type TestCase = {
    desc: string
    setup?: string
    input: string
    expected: string
  }
  const cases = resources.json<TestCase[]>('posix/shell-exprs.json')
  test.each(cases)('$desc', ({setup = '', input, expected}) => {
    const src = new Source(`${setup}\n__TEST_EXPR__=${input}`)
    const result = evaluate(parse(src))
    expect(result).toEqual(new Map([
      ['__TEST_EXPR__', expected],
    ]))
  })
})
