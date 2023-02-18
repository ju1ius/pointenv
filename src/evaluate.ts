import {UndefinedVariable} from './errors.js'
import {AssignmentList, CompositeValue, Expression, RawValue, Reference} from './ast.js'

export default (list: AssignmentList, scope: Map<string, string> = new Map()) => {
  return new Evaluator(list, scope).evaluate()
}

const isUnset = (value: string | null | undefined): value is undefined => value === undefined
const isUnsetOrNull = (value: string | null | undefined): value is undefined | null | '' => value == null || value === ''


class Evaluator {
  private scope: Map<string, string> = new Map()

  constructor(
    private readonly list: AssignmentList,
    private readonly parentScope: Map<string, string>,
  ) {}

  evaluate() {
    for (const assignment of this.list.nodes) {
      const key = assignment.id
      if (assignment.rhs === null) {
        this.scope.set(key, '')
        continue
      }
      const value = this.evaluateExpression(assignment.rhs)
      this.scope.set(key, value)
    }
    return this.scope
  }

  private evaluateExpression(expr: Expression) {
    if (expr instanceof RawValue) {
      return expr.value
    }
    if (expr instanceof CompositeValue) {
      let value = ''
      for (const child of expr.nodes) {
        value += this.evaluateExpression(child)
      }
      return value
    }
    return this.evaluateReference(expr)
  }

  /**
   * @link https://pubs.opengroup.org/onlinepubs/9699919799/utilities/V3_chap02.html#tag_18_06_02
   */
  private evaluateReference(ref: Reference): string {
    let key = ref.id
    let value = this.scope.get(key) ?? this.parentScope.get(key) ?? undefined
    let checkNull = (ref.op ?? '').charAt(0) === ':'
    let test = checkNull ? isUnsetOrNull : isUnset
    switch (ref.op) {
      case '-':
      case ':-': {
        if (!test(value)) return value ?? ''
        if (!ref.rhs) return ''
        return this.evaluateExpression(ref.rhs)
      }
      case '=':
      case ':=': {
        if (!test(value)) return value ?? ''
        if (!ref.rhs) {
          this.scope.set(key, '')
          return ''
        }
        value = this.evaluateExpression(ref.rhs)
        this.scope.set(key, value)
        return value
      }
      case '+':
      case ':+': {
        if (test(value) || !ref.rhs) return ''
        return this.evaluateExpression(ref.rhs)
      }
      case '?':
      case ':?': {
        if (!test(value)) return value ?? ''
        if (!ref.rhs) {
          throw new UndefinedVariable(`Undefined variable "${key}".`)
        }
        const message = this.evaluateExpression(ref.rhs)
        throw new UndefinedVariable(message)
      }
      default:
        return value ?? ''
    }
  }
}
