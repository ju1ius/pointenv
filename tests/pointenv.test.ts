import { assert } from './deps.ts'
const { assertEquals, assertObjectMatch } = assert

import pointenv, { load } from '../mod.ts'
import { toScope } from '../src/evaluate.ts'

type TestCase = {
  desc: string
  files: Record<string, string>
  options?: import('../mod.ts').Options
  expected: Record<string, string>
}

const mockReader = (files: Record<string, string>) => (path: string) => Promise.resolve(files[path])

const backupEnv = Deno.env.toObject()

function restoreEnv(original: object) {
  for (const k of Object.keys(Deno.env.toObject())) {
    Deno.env.delete(k)
  }
  for (const [k, v] of Object.entries(original)) {
    Deno.env.set(k, v)
  }
}

type StepFn = (t: Deno.TestContext) => void | Promise<void>

function wrapStep<T>(
  f: StepFn,
  setup: () => T,
  teardown: (setup: T) => void,
): StepFn {
  return (t: Deno.TestContext) => {
    const s = setup()
    try {
      return f(t)
    } finally {
      teardown(s)
    }
  }
}

Deno.test('pointenv', async (t) => {
  for (
    const data of [
      {
        desc: 'modifies Deno.env when a variable is not defined',
        files: { 'one': 'foo=yep' },
        expected: { foo: 'yep' },
      },
      {
        desc: 'does not modify Deno.env when a variable is defined',
        files: { 'one': 'TEST_IS_DEFINED=nope' },
        expected: { TEST_IS_DEFINED: 'yep' },
      },
      {
        desc: 'modifies Deno.env when a variable is defined but override is true',
        files: { 'one': 'TEST_IS_DEFINED=nope' },
        options: { override: true },
        expected: { TEST_IS_DEFINED: 'nope' },
      },
    ] as TestCase[]
  ) {
    const { desc, files, options, expected } = data
    await t.step(
      desc,
      wrapStep(
        async () => {
          const paths = Object.keys(files)
          const result = await pointenv(paths, {
            ...options,
            reader: mockReader(files),
          })
          assertEquals(result, new Map(Object.entries(expected)))
          assertObjectMatch(Deno.env.toObject(), expected)
        },
        () => {
          Deno.env.set('TEST_IS_DEFINED', 'yep')
        },
        () => {
          restoreEnv(backupEnv)
        },
      ),
    )
  }
})

Deno.test('load', async (t) => {
  for (
    const data of [
      {
        desc: 'empty file',
        files: { '~/empty': '' },
        expected: {},
      },
      {
        desc: 'merges scope from provided files',
        files: {
          'one': 'a=1',
          'two': 'b=2',
        },
        expected: { a: '1', b: '2' },
      },
      {
        desc: 'overrides scope from latest file',
        files: {
          'one': 'a=1',
          'two': 'a=2',
        },
        expected: { a: '2' },
      },
      {
        desc: 'resolves across files',
        files: {
          'one': 'a=1',
          'two': 'b=${nope:-$a}',
        },
        expected: { a: '1', b: '1' },
      },
      {
        desc: 'uses process.env by default',
        files: {
          'one': 'a=${PATH}',
        },
        expected: { a: Deno.env.get('PATH')! },
      },
      {
        desc: 'uses the env options',
        files: {
          'one': 'a=${foo}',
          'two': 'b=${bar}',
        },
        options: { env: { foo: '1', bar: '2' } },
        expected: { a: '1', b: '2' },
      },
    ] as TestCase[]
  ) {
    const { desc, files, options, expected } = data
    await t.step(
      desc,
      wrapStep(
        async () => {
          const paths = Object.keys(files)
          const result = await load(paths, {
            ...options,
            reader: mockReader(files),
          })
          assertEquals(result, toScope(expected))
        },
        () => {},
        () => {
          restoreEnv(backupEnv)
        },
      ),
    )
  }
})
