import {AssignmentList} from './ast.js'

export enum Dialect {
  Posix = 'posix',
  Compose = 'compose',
  Symfony = 'symfony',
}

export type Parser = (input: string) => AssignmentList

export async function getParser(dialect: Dialect): Promise<Parser> {
  const module = await import(`./dialects/${dialect}.js`)
  return module.default
}
