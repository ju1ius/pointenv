import {isDeno} from 'https://deno.land/x/which_runtime/mod.ts'

import type {Assignment} from './dialects/common/ast.ts'
import type {Source} from './source.ts'

export enum Dialect {
  Posix = 'posix',
  Compose = 'compose',
  Symfony = 'symfony',
}

export type Parser = (source: Source) => Assignment[]

export async function getParser(dialect: Dialect): Promise<Parser> {
  const ext = isDeno ? 'ts' : 'js'
  const module = await import(`./dialects/${dialect}.${ext}`)
  return module.default
}
