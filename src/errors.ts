import type { Source } from './source.ts'

export class ParseError extends Error {
  static in(src: Source, offset: number, message: string) {
    const { line, column } = src.positionAt(offset)
    return new ParseError(`${message} in ${src.filename} on line ${line}, column ${column}.`)
  }
}

export class EvaluationError extends Error {}

export class UndefinedVariable extends EvaluationError {}
