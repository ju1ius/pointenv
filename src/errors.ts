
export class ParseError extends Error {}

export class EvaluationError extends Error {}

export class UndefinedVariable extends EvaluationError {}
