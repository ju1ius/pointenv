export class AssignmentList {
  constructor(
    public readonly nodes: Assignment[]
  ) {
  }
}

export class Assignment {
  constructor(
    public readonly id: string,
    public rhs: Expression[],
  ) {
  }
}

export class Characters {
  constructor(
    public readonly value: string
  ) {
  }
}

export type Operator =
  | '-' | ':-'
  | '=' | ':='
  | '+' | ':+'
  | '?' | ':?'

export class Expansion {
  constructor(
    public readonly id: string,
    public readonly op: Operator = '-',
    public rhs: Expression[] = [],
  ) {
  }
}

export type Expression =
  | Characters
  | Expansion

export type Node =
  | AssignmentList
  | Assignment
  | Expression
