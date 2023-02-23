import {Scope} from './evaluate.js'
import load, {type LoadOptions} from './load.js'

export {Dialect} from './dialects.js'
export {load, type LoadOptions}

export type Options = LoadOptions & {
  override?: boolean
}

export default async (paths: string[], options: Options = {}) => {
  const scope = await load(paths, options)
  return applyScope(scope, options.override)
}

function applyScope(scope: Scope, override = false) {
  const applied = new Map<string, string>()
  for (const [key, value] of scope.entries()) {
    if (override || process.env[key] === undefined) {
      applied.set(key, process.env[key] = value)
    }
  }
  return applied
}
