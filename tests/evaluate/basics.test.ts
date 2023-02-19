import {ParseError} from '../../src/errors.js'
import {assertEval, type TestCase} from './utils.js'

test.each<TestCase>([
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
])('simple assignments: $desc', (data) => {
  assertEval(data)
})

test.each<TestCase>([
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
])('comments: $desc', (data) => {
  assertEval(data)
})

test.each<TestCase>([
  {
    input: `a='foo'bar"baz"`,
    expected: {a: 'foobarbaz'},
    desc: `works w/ all quoting styles`,
  },
  {
    input: `a=a\\\n'b'\\\n"c"`,
    expected: {a: 'abc'},
    desc: `supports POSIX-style line continuations`,
  },
])('concatenation: $desc', data => {
  assertEval(data)
})

test.each<TestCase>([
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
    input: `a=\\$b`,
    expected: {a: '$b'},
    desc: `escaped $ does not invoke expansion`,
  },
])('escaping: $desc', (data) => {
  assertEval(data)
})

test.each<TestCase>([
  {
    input: `a='0\\n1\\t2'`,
    expected: {a: '0\\n1\\t2'},
    desc: 'Single-quoted string does not interpret escaped characters.',
  },
])('quoting: $desc', data => {
  assertEval(data)
})

test.each<TestCase>([
  {
    desc: 'at start of line',
    input: 'export a=1 b=2',
    expected: {a: '1', b: '2'},
  },
  {
    desc: 'after an assignment on the same line',
    input: 'a=1 export b=2',
    error: ParseError,
  },
  {
    desc: 'after another export on the same line',
    input: 'export a=1 export b=2',
    error: ParseError,
  },
])('export command: $desc', (data) => {
  assertEval(data)
})
