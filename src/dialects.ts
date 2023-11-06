import type {Assignment} from './dialects/common/ast.ts'
import type {Source} from './source.ts'

export enum Dialect {
  Posix = 'posix',
  Compose = 'compose',
  Symfony = 'symfony',
}

export type Parser = (source: Source) => Assignment[]

export async function getParser(dialect: Dialect): Promise<Parser> {
  const module = await import(`./dialects/${dialect}.js`)
  return module.default
}
