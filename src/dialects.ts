import {AssignmentList} from './ast.js'

export enum Dialect {
  Posix = 'posix',
  Docker = 'docker',
}

export type Parser = (input: string) => AssignmentList

export async function getParser(dialect: Dialect): Promise<Parser> {
  const module = await import(`./parsers/${dialect}.js`)
  return module.default
}
