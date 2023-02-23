import path from 'node:path'
import {readFileSync} from 'node:fs'

import * as resources from '../resources.js'
import {assertEval, TestCase} from './utils.js'
import parse from '../../src/parsers/symfony.js'
import {ParseError} from '../../src/errors.js'

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
  test.each<TestCase>([
    {
      desc: 'whitespace after = in non-empty assignment',
      input: 'a= 1',
      error: ParseError,
    },
  ])('$desc', (data) => {
    assertEval(data, parse)
  })
})
