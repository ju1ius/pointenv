import {AssignmentList, CompositeValue, Expression, RawValue, Reference, SimpleReference} from './ast.js'
import {UndefinedVariable} from './errors.js'

export type Scope = Map<string, string>
export type Handlers = {
  missingValue?: (key: string, env: Scope, scope: Scope) => string | undefined
}
export type EvaluateOptions = {
  scope: Scope
  override: boolean
  handlers: Handlers
}

export default (list: AssignmentList, scope: Scope = new Map(), override = false, handlers: Handlers = {}) => {
  return new Evaluator(list, scope, override, handlers).evaluate()
}

export function toScope(input: Scope | Record<string, string | undefined>): Scope {
  const entries = input instanceof Map ? Array.from(input.entries()) : Object.entries(input)
  return new Map(entries.filter(isDefinedEntry))
}

const isDefinedEntry = (entry: any[]): entry is [string, string] =>
  entry.every(v => typeof v === 'string')

const isUnset = (value: string | null | undefined): value is undefined =>
  value === undefined

const isUnsetOrNull = (value: string | null | undefined): value is undefined | null | '' =>
  value == null || value === ''


class Evaluator {
  private scope: Scope = new Map()

  constructor(
    private readonly list: AssignmentList,
    private readonly env: Scope,
    private readonly overrideEnv: boolean,
    private readonly handlers: Handlers,
  ) {}

  evaluate() {
    for (const assignment of this.list.nodes) {
      const key = assignment.id
      if (!this.overrideEnv && this.env.has(key)) {
        this.scope.set(key, this.env.get(key)!)
        continue
      }
      if (assignment.rhs === null) {
        this.scope.set(key, this.resolve(key) ?? '')
        continue
      }
      const value = this.evaluateExpression(assignment.rhs)
      this.scope.set(key, value)
    }
    return this.scope
  }

  private evaluateExpression(expr: Expression): string {
    if (expr instanceof RawValue) {
      return expr.value
    }
    if (expr instanceof CompositeValue) {
      return expr.nodes.reduce(
        (value, node) => value + this.evaluateExpression(node),
        ''
      )
    }
    return this.evaluateReference(expr)
  }

  /**
   * @link https://pubs.opengroup.org/onlinepubs/9699919799/utilities/V3_chap02.html#tag_18_06_02
   */
  private evaluateReference(ref: Reference): string {
    const key = ref.id
    let value = this.resolve(key)

    if (ref instanceof SimpleReference) {
      return value ?? ''
    }

    let checkNull = (ref.op ?? '').charAt(0) === ':'
    let test = checkNull ? isUnsetOrNull : isUnset
    switch (ref.op) {
      case '-':
      case ':-': {
        if (!test(value)) return value ?? ''
        return this.evaluateExpression(ref.rhs)
      }
      case '=':
      case ':=': {
        if (!test(value)) return value ?? ''
        value = this.evaluateExpression(ref.rhs)
        this.scope.set(key, value)
        return value
      }
      case '+':
      case ':+': {
        if (test(value)) return ''
        return this.evaluateExpression(ref.rhs)
      }
      case '?':
      case ':?': {
        if (!test(value)) return value ?? ''
        if (this.handlers.missingValue) {
          value = this.handlers.missingValue(key, this.env, this.scope)
          if (!test(value)) return value ?? ''
        }
        let message = this.evaluateExpression(ref.rhs)
        if (!message) {
          message = `Missing value for variable "${key}"`
        }
        throw new UndefinedVariable(message)
      }
    }
  }

  private resolve(key: string) {
    if (this.overrideEnv) {
      return this.scope.get(key) ?? this.env.get(key)
    }
    return this.env.get(key) ?? this.scope.get(key)
  }
}
