import {readFile} from 'node:fs/promises'

import {Dialect, getParser, type Parser} from './dialects.js'
import evaluate, {toScope, type Scope} from './evaluate.js'
import {Source} from './source.js'

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
  const input = await readFile(path, {encoding: 'utf-8'})
  return parse(new Source(input, path))
}

function normalizeOptions(opts: LoadOptions) {
  return {
    dialect: opts.dialect ?? Dialect.Posix,
    env: toScope(opts.env ?? process.env),
    override: opts.override ?? false,
  }
}
