import {Assignment, Expression, Expansion} from './dialects/common/ast.ts'
import {UndefinedVariable} from './errors.ts'

export type Scope = Map<string, string>

export default (nodes: Assignment[], scope: Scope = new Map(), override = false) => {
  return new Evaluator(nodes, scope, override).evaluate()
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
    private readonly nodes: Assignment[],
    private readonly env: Scope,
    private readonly overrideEnv: boolean,
  ) {}

  evaluate() {
    for (const assignment of this.nodes) {
      const key = assignment.id
      if (!this.overrideEnv && this.env.has(key)) {
        this.scope.set(key, this.env.get(key)!)
        continue
      }
      const value = this.evaluateExpression(assignment.rhs)
      this.scope.set(key, value)
    }
    return this.scope
  }

  private evaluateExpression(nodes: Expression[]): string {
    let result = ''
    for (const expr of nodes) {
      if (expr instanceof Expansion) {
        result += this.evaluateExpansion(expr)
      } else {
        result += expr
      }
    }
    return result
  }

  /**
   * @link https://pubs.opengroup.org/onlinepubs/9699919799/utilities/V3_chap02.html#tag_18_06_02
   */
  private evaluateExpansion(node: Expansion): string {
    const {id, op, rhs} = node
    const value = this.resolve(id)
    switch (op) {
      case '-':
        return isUnset(value) ? this.evaluateExpression(rhs) : value
      case ':-':
        return isUnsetOrNull(value) ? this.evaluateExpression(rhs) : value
      case '=':
        return isUnset(value) ? this.assign(id, this.evaluateExpression(rhs)) : value
      case ':=':
        return isUnsetOrNull(value) ? this.assign(id, this.evaluateExpression(rhs)) : value
      case '+':
        return isUnset(value) ? '' : this.evaluateExpression(rhs)
      case ':+':
        return isUnsetOrNull(value) ? '' : this.evaluateExpression(rhs)
      case '?':
        if (isUnset(value)) {
          throw this.undefinedVariable(id, this.evaluateExpression(rhs))
        }
        return value
      case ':?':
        if (isUnsetOrNull(value)) {
          throw this.undefinedVariable(id, this.evaluateExpression(rhs))
        }
        return value
    }
  }

  private resolve(key: string) {
    if (this.overrideEnv) {
      return this.scope.get(key) ?? this.env.get(key)
    }
    return this.env.get(key) ?? this.scope.get(key)
  }

  private assign(key: string, value: string) {
    this.scope.set(key, value)
    return value
  }

  private undefinedVariable(name: string, message: string) {
    if (!message) {
      message = `Missing required value for variable "${name}"`
    }
    return new UndefinedVariable(message)
  }
}
