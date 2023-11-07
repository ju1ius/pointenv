import { assert } from '../deps.ts'
const { assertEquals, assertThrows } = assert

import { Parser } from '../../src/dialects.ts'
import evaluate, { type Scope, toScope } from '../../src/evaluate.ts'
import { Source } from '../../src/source.ts'

type TestInput = {
  desc: string
  input: string
  env?: Scope
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

export const assertEval = (
  { input, env = new Map(), override, ...rest }: TestCase,
  parse: Parser,
) => {
  if ('error' in rest) {
    assertThrows(
      () => {
        const ast = parse(new Source(input))
        evaluate(ast, toScope(env), override)
      },
      // @ts-ignore WIP: change the error type
      rest.error,
    )
  } else {
    const ast = parse(new Source(input))
    assertEquals(
      evaluate(ast, toScope(env), override),
      toScope(rest.expected),
    )
  }
}
