import {readFileSync} from 'node:fs'
import path from 'node:path'

import * as resources from '../resources.js'

import evaluate from '../../src/evaluate.js'
import parse from '../../src/parsers/compose.js'

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
    const ast = parse(input)
    const result = evaluate(ast)
    expect(result).toEqual(expected)
  })
})
