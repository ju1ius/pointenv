import {readFile} from 'node:fs/promises'

import {Assignment, AssignmentList} from './ast.js'
import evaluate, {toScope, type Scope} from './evaluate.js'
import parse from './parse.js'

type Env = Record<string, string | undefined>

export interface LoadOptions {
  env?: Env | Scope
}

export default async (paths: string[], options: LoadOptions = {}) => {
  const opts = normalizeOptions(options)
  const lists = await Promise.all(paths.map(parseFile))
  const ast = mergeAssignments(lists)
  return evaluate(ast, opts.env)
}

function mergeAssignments(lists: AssignmentList[]): AssignmentList {
  return new AssignmentList(lists.reduce(
    (acc, {nodes}) => acc.concat(nodes),
    [] as Assignment[],
  ))
}

async function parseFile(path: string) {
  const input = await readFile(path, {encoding: 'utf-8'})
  return parse(input)
}

function normalizeOptions(opts: LoadOptions) {
  return {
    env: toScope(opts.env ?? process.env),
  }
}
