import {Parser} from '../../src/dialects.js'
import evaluate, {toScope, type Scope} from '../../src/evaluate.js'
import {Source} from '../../src/source.js'

type TestInput = {
  desc: string
  input: string
  env?: Scope | NodeJS.Dict<string>
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


export const assertEval = ({input, env = new Map(), override, ...rest}: TestCase, parse: Parser) => {
  if ('error' in rest) {
    expect(() => {
      const ast = parse(new Source(input))
      evaluate(ast, toScope(env), override)
    }).toThrow(rest.error)
  } else {
    const ast = parse(new Source(input))
    expect(evaluate(ast, toScope(env), override)).toEqual(toScope(rest.expected))
  }
}
