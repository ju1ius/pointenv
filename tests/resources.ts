import nodeGlob from 'glob'
import {readFileSync} from 'node:fs'
import nodePath from 'node:path'
import {fileURLToPath} from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

export function path(relativePath: string) {
  return nodePath.resolve(`${__dirname}/resources`, relativePath)
}

export function read(relativePath: string) {
  return readFileSync(path(relativePath), {encoding: 'utf-8'})
}

export function json<T>(path: string): T {
  return JSON.parse(read(path))
}

export function glob(pattern: string) {
  return nodeGlob.sync(pattern, {
    cwd: `${__dirname}/resources`,
    root: `${__dirname}/resources`,
    absolute: true,
  })
}
