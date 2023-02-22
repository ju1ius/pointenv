import evaluate, {toScope, type Scope} from '../../src/evaluate.js'
import {Parser} from '../../src/dialects.js'

type TestInput = {
  desc: string
  input: string
  scope?: Scope | NodeJS.Dict<string>
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


export const assertEval = ({input, scope = new Map(), ...rest}: TestCase, parse: Parser) => {
  if ('error' in rest) {
    expect(() => {
      const ast = parse(input)
      evaluate(ast, toScope(scope))
    }).toThrow(rest.error)
  } else {
    const ast = parse(input)
    expect(evaluate(ast, toScope(scope))).toEqual(toScope(rest.expected))
  }
}
