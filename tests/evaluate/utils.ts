import parse from '../../src/parse.js'
import evaluate from '../../src/evaluate.js'

type TestInput = {
  desc: string
  input: string
  scope?: Map<string, string>
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


export const toMap = (o: Object) => new Map(Object.entries(o))

export const assertEval = ({input, scope = new Map(), ...rest}: TestCase) => {
  if ('error' in rest) {
    expect(() => {
      const ast = parse(input)
      evaluate(ast, scope)
    }).toThrow(rest.error)
  } else {
    const ast = parse(input)
    expect(evaluate(ast, scope)).toEqual(toMap(rest.expected))
  }
}
