import {fs, path as stdPath} from './deps.ts'

const {fromFileUrl, resolve} = stdPath
const {walkSync} = fs

const specPath = fromFileUrl(new URL('../dotenv-spec/tests', import.meta.url))

export function path(relativePath: string) {
  return resolve(specPath, relativePath)
}

export function filesIn(relativePath: string, opts: fs.WalkOptions = {}): IterableIterator<fs.WalkEntry> {
  return walkSync(path(relativePath), {
    ...opts,
    exts: ['json'],
    includeDirs: false,
    includeSymlinks: false,
  })
}
