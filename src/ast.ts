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

export class Reference {
  constructor(
    public readonly id: string,
    public readonly op?: string,
    public readonly rhs?: CompositeValue,
  ) {
  }
}

export type AnyValue =
  | RawValue
  | CompositeValue

export type Expression =
  | AnyValue
  | Reference
