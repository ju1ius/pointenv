import {fs, path as stdPath} from './deps.ts'

const {fromFileUrl, resolve} = stdPath
const {walkSync} = fs

const __dirname = fromFileUrl(new URL('.', import.meta.url))

export function path(relativePath: string) {
  return resolve(`${__dirname}/resources`, relativePath)
}

export function read(relativePath: string) {
  return Deno.readTextFileSync(path(relativePath))
}

export function json<T>(relativePath: string): T {
  return JSON.parse(read(relativePath))
}

export function filesIn(relativePath: string, opts: fs.WalkOptions): IterableIterator<fs.WalkEntry> {
  return walkSync(path(relativePath), {
    ...opts,
    includeDirs: false,
    includeSymlinks: false,
  })
}
