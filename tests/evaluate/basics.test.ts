import parse from '../../src/parse.js'
import evaluate from '../../src/evaluate.js'

const toMap = (o: Object) => new Map(Object.entries(o))
const assertEval = (input: string, expected: Object) => {
  const ast = parse(input)
  expect(evaluate(ast)).toEqual(toMap(expected))
}

test.each([
  {
    input: 'foo=',
    expected: {foo: ''},
    desc: 'empty value',
  },
  {
    input: `foo=bar`,
    expected: {foo: 'bar'},
    desc: 'unquoted value',
  },
  {
    input: `foo='bar'`,
    expected: {foo: 'bar'},
    desc: 'single-quoted value',
  },
  {
    input: `foo="bar"`,
    expected: {foo: 'bar'},
    desc: 'double-quoted value',
  },
  {
    input: `foo=bar bar=baz`,
    expected: {foo: 'bar', bar: 'baz'},
    desc: 'supports multiple assignments per line',
  },
  {
    input: `\
a='b
c'
d="e
f"`,
    expected: {a: 'b\nc', d: 'e\nf'},
    desc: 'supports multiline values in quoted strings',
  },
  {
    input: 'a=1 a=2',
    expected: {a: '2'},
    desc: 'duplicated identifier => last value wins',
  },
])('simple assignments: $desc', ({input, expected}) => {
  assertEval(input, expected)
})

test.each([
  {
    input: `foo=1#2`,
    expected: {foo: '1#2'},
    desc: '# inside value is not a comment',
  },
  {
    input: `foo=bar # it's a foo!`,
    expected: {foo: 'bar'},
    desc: '# after unquoted value starts a comment',
  },
  {
    input: `\
# first=1
a=b
# last=1`,
    expected: {a: 'b'},
    desc: 'ignores comments at start/end of input'
  }
])('comments: $desc', ({input, expected}) => {
  assertEval(input, expected)
})

test.each([
  {
    input: `a='b\\'c'`,
    expected: {a: "b'c"},
    desc: `escaped single-quote in singe-quoted string`,
  },
  {
    input: `a="b\\"c"`,
    expected: {a: 'b"c'},
    desc: `escaped double-quote in double-quoted string`,
  },
  {
    input: `a=b\\ c`,
    expected: {a: 'b c'},
    desc: `escaped space in unquoted string`,
  },
  {
    input: `\
a=b\\
c`,
    expected: {a: 'b\nc'},
    desc: `escaped newline in unquoted string`,
  },
  {
    input: `a=\\$b`,
    expected: {a: '$b'},
    desc: `escaped $ does not invoke expansion`,
  },
])('escaping: $desc', ({input, expected}) => {
  assertEval(input, expected)
})