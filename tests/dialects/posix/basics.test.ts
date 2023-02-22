import {ParseError} from '../../../src/errors.js'
import parse from '../../../src/parsers/posix.js'
import {assertEval, type TestCase} from '../utils.js'

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
  {
    input: 'a= "b"',
    error: ParseError,
    desc: 'invalid whitespace after equal sign',
  },
  {
    input: 'A=\nB=',
    expected: {A: '', B: ''},
    desc: 'newline or EOF after equal sign',
  },
])('simple assignments: $desc', (data) => {
  assertEval(data, parse)
})

test.each<TestCase>([
  {
    input: `
foo=1#2
bar='1'#2
baz="1"#2
    `,
    expected: {foo: '1#2', bar: '1#2', baz: '1#2'},
    desc: '# inside value is not a comment',
  },
  {
    input: `
foo=1 # a comment
bar='1' # a comment
baz="1" # a comment
    `,
    expected: {foo: '1', bar: '1', baz: '1'},
    desc: '# after unquoted value starts a comment',
  },
  {
    input: `\
# first=1
a=b
# last=1`,
    expected: {a: 'b'},
    desc: 'ignores comments at start/end of input'
  },
])('comments: $desc', (data) => {
  assertEval(data, parse)
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
  assertEval(data, parse)
})

test.each<TestCase>([
  {
    input: `a="b\\"c"`,
    expected: {a: 'b"c'},
    desc: `escaped double-quote in double-quoted string`,
  },
  {
    input: `a='b'\\''c'`,
    expected: {a: "b'c"},
    desc: `escaped single-quote in singe-quoted string`,
  },
  {
    input: `a='b\\'c'`,
    desc: `wrong single-quote escaping`,
    error: ParseError,
  },
  {
    input: `a=b\\ c`,
    expected: {a: 'b c'},
    desc: `escaped space in unquoted string`,
  },
  {
    input: `a=\\$b`,
    expected: {a: '$b'},
    desc: `escaped $ in unquoted value does not invoke expansion`,
  },
  {
    input: `a="\\$b"`,
    expected: {a: '$b'},
    desc: `escaped $ in double-quoted value does not invoke expansion`,
  },
  {
    input: `a="\\o"`,
    expected: {a: '\\o'},
    desc: `escaped non-special character is returned verbatim`,
  },
])('escaping: $desc', (data) => {
  assertEval(data, parse)
})

test.each<TestCase>([
  {
    input: `a='0\\n1\\t2'`,
    expected: {a: '0\\n1\\t2'},
    desc: 'Single-quoted string does not interpret escaped characters.',
  },
])('quoting: $desc', data => {
  assertEval(data, parse)
})

