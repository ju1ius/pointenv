import {readFileSync} from 'node:fs'
import path from 'node:path'

import * as resources from '../resources.js'

import evaluate from '../../src/evaluate.js'
import parse from '../../src/dialects/compose.js'
import {assertEval, TestCase} from './utils.js'
import {ParseError} from '../../src/errors.js'
import {Source} from '../../src/source.js'

const loadCases = () => {
  type DataSet = Array<{key: string, value: string}>
  return resources.glob('compose/*.env').map((file) => {
    const input = readFileSync(file, {encoding: 'utf-8'})
    const name = path.basename(file)
    const outFile = path.resolve(path.dirname(file), `${name}.expected.json`)
    const results: DataSet = JSON.parse(readFileSync(outFile, {encoding: 'utf-8'}))
    const expected = new Map(
      results.map(({key, value}) => [key, value])
    )
    return {
      desc: name,
      input,
      expected,
    }
  })
}

describe('compose dialect', () => {
  test.each(loadCases())('file $desc', ({input, expected}) => {
    const ast = parse(new Source(input))
    const result = evaluate(ast)
    expect(result).toEqual(expected)
  })

  test.each<TestCase>([
    {
      desc: 'eof in assignment-value state',
      input: 'a=',
      expected: {a: ''},
    },
    {
      desc: 'eof after whitespace in unquoted state',
      input: 'a= \t ',
      expected: {a: ''},
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
    }
  ])('$desc', (data) => {
    assertEval(data, parse)
  })
})
