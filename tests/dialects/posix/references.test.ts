import parse from '../../../src/parsers/posix.js'

import {assertEval, type TestCase} from '../utils.js'

test.each<TestCase>([
  {
    input: `a=1 b=$a c="$a" d='$a'`,
    expected: {a: '1', b: '1', c: '1', d: '$a'},
    scope: {a: '0'},
    desc: 'picks value from local scope',
  },
  {
    input: `a=$b b="$b" c='$b'`,
    expected: {a: '1', b: '1', c: '$b'},
    scope: {b: '1'},
    desc: 'picks value from global scope',
  },
  {
    input: `a=1 b=\${a} c="\${a}" d='\${a}'`,
    expected: {a: '1', b: '1', c: '1', d: '${a}'},
    desc: 'braced identifier',
  },
  {
    input: `a=nic b=frob\${a}ate`,
    expected: {a: 'nic', b: 'frobnicate'},
    desc: 'composite value in unquoted string',
  },
  {
    input: `a=bar b="foo\${a}baz"`,
    expected: {a: 'bar', b: 'foobarbaz'},
    desc: 'composite value in double-quoted string',
  },
])('simple references: $desc', (data) => {
  assertEval(data, parse)
})

test.each<TestCase>([
  {
    input: 'a=${a:-0} b=${b:-} c=${c:-1}',
    expected: {a: '42', b: '', c: '1'},
    scope: {a: '42', c: ''},
    desc: ':- operator falls back to provided default',
  },
  {
    input: `a=\${a:-"foo\${b:-"\${c:-'nope'}"}baz"}`,
    expected: {a: 'foobarbaz'},
    scope: {c: 'bar'},
    desc: ':- operator supports recursive expansion',
  },
  {
    input: `a=\${a:=foo} b=$a`,
    expected: {a: 'foo', b: 'foo'},
    desc: ':= operator performs fallback assignment',
  },
  {
    input: `d=\${a:=foo\${b:=bar\${c:=baz}}}`,
    expected: {a: 'foobarbaz', b: 'barbaz', c: 'baz', d: 'foobarbaz'},
    desc: ':= operator supports recursive expansion',
  },
])('complex references: $desc', data => {
  assertEval(data, parse)
})

test.each<TestCase>([
  {
    input: `
foo=\${NOPE:-foo\
    bar}`,
    expected: {foo: 'foo    bar'},
    desc: 'line continuation in unquoted expansion',
  },
  {
    input: `
foo="\${NOPE:-foo\
    bar}"`,
    expected: {foo: 'foo    bar'},
    desc: 'line continuation in double-quoted expansion',
  },
  {
    input: `
foo='\${NOPE:-foo\
    bar}'`,
    expected: {foo: 'foo\\\n    bar'},
    desc: 'no line continuations in single-quoted expansions',
  },
])('whitespace: $desc', (data) => {
  assertEval(data, parse)
})
