import { type Scope } from './src/evaluate.ts'
import load, { type LoadOptions } from './src/load.ts'

export type { LoadOptions, Scope }
export { Dialect } from './src/dialects.ts'
export { load }

export type Options = LoadOptions

export default async (paths: string[], options: Options = {}) => {
  const scope = await load(paths, options)
  applyScope(scope, options.override)
  return scope
}

function applyScope(scope: Scope, override = false) {
  for (const [key, value] of scope.entries()) {
    if (override || !Deno.env.has(key)) {
      Deno.env.set(key, value)
    }
  }
}
