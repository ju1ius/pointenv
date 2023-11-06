import {Dialect, getParser, type Parser} from './dialects.ts'
import evaluate, {toScope, type Scope} from './evaluate.ts'
import {Source} from './source.ts'

type Env = Record<string, string | undefined>

export interface LoadOptions {
  dialect?: Dialect
  env?: Env | Scope
  override?: boolean
}

export default async (paths: string[], options: LoadOptions = {}) => {
  const opts = normalizeOptions(options)
  const parser = await getParser(opts.dialect)
  const lists = await Promise.all(paths.map(path => parseFile(path, parser)))
  const ast = lists.flat()
  return evaluate(ast, opts.env, opts.override)
}

async function parseFile(path: string, parse: Parser) {
  const input = await Deno.readTextFile(path, {})
  return parse(new Source(input, path))
}

function normalizeOptions(opts: LoadOptions) {
  return {
    dialect: opts.dialect ?? Dialect.Posix,
    env: toScope(opts.env ?? Deno.env.toObject()),
    override: opts.override ?? false,
  }
}
