import fs from 'node:fs/promises'
import {toScope} from '../src/evaluate.js'
import pointenv, {load, type Options} from '../src/index.js'

jest.mock('node:fs/promises')

type TestCase = {
  desc: string
  files: Record<string, string>
  options?: Options
  expected: Record<string, string>,
}

describe('pointenv', () => {
  const backupEnv = process.env
  beforeEach(() => {
    jest.resetAllMocks()
    Object.assign(process.env, {
      TEST_IS_DEFINED: 'yep',
    })
  })
  afterEach(() => {
    process.env = backupEnv
  })
  test.each<TestCase>([
    {
      desc: 'modifies process.env when a variable is not defined',
      files: {'one': 'foo=yep'},
      expected: {foo: 'yep'},
    },
    {
      desc: 'does not modify process.env when a variable is defined',
      files: {'one': 'TEST_IS_DEFINED=nope'},
      expected: {},
    },
    {
      desc: 'modifies process.env when a variable is defined but override is true',
      files: {'one': 'TEST_IS_DEFINED=nope'},
      options: {override: true},
      expected: {TEST_IS_DEFINED: 'nope'},
    },
  ])('$desc', async ({files, options, expected}) => {
    const readFile = (fs.readFile as jest.Mock).mockImplementation(
      async (path: string) => files[path]
    )
    const paths = Object.keys(files)
    const result = await pointenv(paths, options)
    expect(readFile).toHaveBeenCalledTimes(paths.length)
    expect(result).toEqual(new Map(Object.entries(expected)))
    expect(process.env).toMatchObject(expected)
  })
})

describe('load', () => {
  beforeEach(() => {
    jest.resetAllMocks()
  })

  test.each<TestCase>([
    {
      desc: 'empty file',
      files: {'~/empty': ''},
      expected: {},
    },
    {
      desc: 'merges scope from provided files',
      files: {
        'one': 'a=1',
        'two': 'b=2',
      },
      expected: {a: '1', b: '2'},
    },
    {
      desc: 'overrides scope from latest file',
      files: {
        'one': 'a=1',
        'two': 'a=2',
      },
      expected: {a: '2'},
    },
    {
      desc: 'resolves across files',
      files: {
        'one': 'a=1',
        'two': 'b=${nope:-$a}',
      },
      expected: {a: '1', b: '1'},
    },
    {
      desc: 'uses process.env by default',
      files: {
        'one': 'a=${PATH}',
      },
      expected: {a: process.env.PATH!},
    },
    {
      desc: 'uses the env options',
      files: {
        'one': 'a=${foo}',
        'two': 'b=${bar}',
      },
      options: {env: {foo: '1', bar: '2'}},
      expected: {a: '1', b: '2'},
    },
  ])('$desc', async ({files, options, expected}) => {
    const readFile = (fs.readFile as jest.Mock).mockImplementation(
      async (path: string) => files[path]
    )
    const paths = Object.keys(files)
    const result = await load(paths, options)
    expect(readFile).toHaveBeenCalledTimes(paths.length)
    expect(result).toEqual(toScope(expected))
  })
})

