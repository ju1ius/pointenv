import evaluate from '../../../src/evaluate.js'
import parse from '../../../src/parsers/posix.js'
import * as resources from '../../resources.js'


describe('shell compatibility', () => {
  type TestCase = {
    desc: string
    setup?: string
    input: string
    expected: string
  }
  const cases = resources.json<TestCase[]>('posix/shell-exprs.json')
  test.each(cases)('$desc', ({setup = '', input, expected}) => {
    const ast = parse(`${setup}\n__TEST_EXPR__=${input}`)
    const result = evaluate(ast)
    expect(result).toEqual(new Map([
      ['__TEST_EXPR__', expected],
    ]))
  })
})
