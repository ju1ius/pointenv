import {ParseError} from './errors.js'

export type Position = {
  line: number
  column: number
}

export class Source {
  constructor(
    public readonly bytes: string,
    public readonly filename: string = '<unknown>',
  ) {
    const p = bytes.indexOf('\x00')
    if (p > -1) {
      throw ParseError.in(this, p, 'Invalid <NUL> character')
    }
  }

  positionAt(offset: number): Position {
    offset = Math.min(this.bytes.length, Math.max(0, offset))
    const lineOffsets = getLineOffsets(this.bytes)
    let line = findLineAt(lineOffsets, offset)
    let column = offset - lineOffsets[line]
    return {
      line: line + 1,
      column: column + 1,
    }
  }
}

function getLineOffsets(input: string) {
  const offsets = [0]
  for (const m of input.matchAll(/\n/g)) {
    offsets.push(m.index! + 1)
  }
  return offsets
}

function findLineAt(offsets: number[], target: number) {
  let left = 0, right = offsets.length - 1
  while (left <= right) {
    const mid = (left + right) >> 1
    const value = offsets[mid]
    if (target > value) {
      left = mid + 1
    } else if (target < value) {
      right = mid - 1
    } else {
      return mid
    }
  }
  // not found, left is the insertion point
  return left - 1
}
