import {Assignment} from './ast.js'

export enum Dialect {
  Posix = 'posix',
  Compose = 'compose',
  Symfony = 'symfony',
}

export type Parser = (input: string) => Assignment[]

export async function getParser(dialect: Dialect): Promise<Parser> {
  const module = await import(`./dialects/${dialect}.js`)
  return module.default
}
