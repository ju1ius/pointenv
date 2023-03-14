import {readFileSync} from 'node:fs'
import path from 'node:path'

import {ParseError} from '../../src/errors.js'
import parse from '../../src/dialects/symfony.js'
import * as resources from '../resources.js'
import {assertEval, TestCase} from './utils.js'

const loadCases = () => {
  return resources.glob('php/symfony/*.env').map((file) => {
    const input = readFileSync(file, {encoding: 'utf-8'})
    const name = path.basename(file)
    const expected = resources.json<Record<string, string>>(`php/symfony/${name}.expected.json`)
    return {
      desc: name,
      input,
      expected,
    }
  })
}

describe('symfony dialect', () => {
  test.each<TestCase>(loadCases())('file $desc', (data) => {
    assertEval(data, parse)
  })

  const invalidExpansionChars = ['$', '"', "'", '{'].map(c => ({
    desc: 'unexpected character in expansion-value state',
    input: `a=\${foo:-${c}}`,
    error: ParseError,
  }))
  test.each<TestCase>([
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
  ])('$desc', (data) => {
    assertEval(data, parse)
  })
})
