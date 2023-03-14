
export class Assignment {
  constructor(
    public readonly id: string,
    public rhs: Expression[],
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

export type Expression = string | Expansion
