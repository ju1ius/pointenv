import {readFile} from 'node:fs/promises'

import {Assignment, AssignmentList} from './ast.js'
import {Dialect, getParser, Parser} from './dialects.js'
import evaluate, {toScope, type Scope} from './evaluate.js'

type Env = Record<string, string | undefined>

export interface LoadOptions {
  dialect?: Dialect
  env?: Env | Scope
}

export default async (paths: string[], options: LoadOptions = {}) => {
  const opts = normalizeOptions(options)
  const parser = await getParser(opts.dialect)
  const lists = await Promise.all(paths.map(path => parseFile(path, parser)))
  const ast = mergeAssignments(lists)
  return evaluate(ast, opts.env)
}

function mergeAssignments(lists: AssignmentList[]): AssignmentList {
  return new AssignmentList(lists.reduce(
    (acc, {nodes}) => acc.concat(nodes),
    [] as Assignment[],
  ))
}

async function parseFile(path: string, parse: Parser) {
  const input = await readFile(path, {encoding: 'utf-8'})
  return parse(input)
}

function normalizeOptions(opts: LoadOptions) {
  return {
    dialect: opts.dialect ?? Dialect.Posix,
    env: toScope(opts.env ?? process.env),
  }
}
