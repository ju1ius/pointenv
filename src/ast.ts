export class AssignmentList {
  constructor(
    public readonly nodes: Assignment[]
  ) {
  }
}

export class Assignment {
  constructor(
    public readonly id: string,
    public rhs: AnyValue | null,
  ) {
  }
}

export class RawValue {
  constructor(
    public readonly value: string
  ) {
  }
}

export class CompositeValue {
  constructor(
    public readonly nodes: Expression[]
  ) {
  }
}

export class SimpleReference {
  constructor(
    public readonly id: string,
  ) {
  }
}

export type Operator =
  | '-' | ':-'
  | '=' | ':='
  | '+' | ':+'
  | '?' | ':?'

export class ComplexReference {
  constructor(
    public readonly id: string,
    public readonly op: Operator,
    public readonly rhs: CompositeValue,
  ) {
  }
}

export type AnyValue =
  | RawValue
  | CompositeValue

export type Reference =
  | SimpleReference
  | ComplexReference

export type Expression =
  | AnyValue
  | Reference
