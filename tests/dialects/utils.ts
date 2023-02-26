import {Parser} from '../../src/dialects.js'
import evaluate, {toScope, type Scope} from '../../src/evaluate.js'

type TestInput = {
  desc: string
  input: string
  scope?: Scope | NodeJS.Dict<string>
  override?: boolean
}

type ExceptionClass = new () => Error

type SuccessCase = TestInput & {
  expected: Record<string, string>
}

type ErrorCase = TestInput & {
  error: Error | ExceptionClass | string | RegExp
}

export type TestCase =
  | SuccessCase
  | ErrorCase


export const assertEval = ({input, scope = new Map(), override, ...rest}: TestCase, parse: Parser) => {
  if ('error' in rest) {
    expect(() => {
      const ast = parse(input)
      evaluate(ast, toScope(scope), override)
    }).toThrow(rest.error)
  } else {
    const ast = parse(input)
    expect(evaluate(ast, toScope(scope), override)).toEqual(toScope(rest.expected))
  }
}
