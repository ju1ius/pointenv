import {type Scope} from './evaluate.js'
import load, {type LoadOptions} from './load.js'

export type {Scope, LoadOptions}
export {Dialect} from './dialects.js'
export {load}

export type Options = LoadOptions

export default async (paths: string[], options: Options = {}) => {
  const scope = await load(paths, options)
  applyScope(scope, options.override)
  return scope
}

function applyScope(scope: Scope, override = false) {
  for (const [key, value] of scope.entries()) {
    if (override || process.env[key] === undefined) {
      process.env[key] = value
    }
  }
}
