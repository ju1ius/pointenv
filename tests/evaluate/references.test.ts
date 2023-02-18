import parse from '../../src/parse.js'
import evaluate from '../../src/evaluate.js'
import {UndefinedVariable} from '../../src/errors.js'

type TestInput = {
  desc: string
  input: string
  scope?: Map<string, string>
}

type ExceptionClass = new () => Error

type SuccessCase = TestInput & {
  expected: Record<string, string>
}
type ErrorCase = TestInput & {
  error: Error | ExceptionClass | string | RegExp
}
type TestCase =
  | SuccessCase
  | ErrorCase


const toMap = (o: Object) => new Map(Object.entries(o))
const assertEval = ({input, scope = new Map(), ...rest}: TestCase) => {
  const ast = parse(input)
  if ('error' in rest) {
    expect(() => evaluate(ast, scope)).toThrow(rest.error)
  } else {
    expect(evaluate(ast, scope)).toEqual(toMap(rest.expected))
  }
}

test.each<TestCase>([
  {
    input: `a=1 b=$a c="$a" d='$a'`,
    expected: {a: '1', b: '1', c: '1', d: '$a'},
    scope: toMap({a: '0'}),
    desc: 'picks value from local scope',
  },
  {
    input: `a=$b b="$b" c='$b'`,
    expected: {a: '1', b: '1', c: '$b'},
    scope: toMap({b: '1'}),
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
  assertEval(data)
})

// test matrix from POSIX spec:
// https://pubs.opengroup.org/onlinepubs/9699919799/utilities/V3_chap02.html#tag_18_06_02
test.each<TestCase & {error?: Function}>([
  // line 1
  {
    input: 'result=${parameter:-word}',
    expected: {result: 'ok'},
    scope: toMap({parameter: 'ok'}),
    desc: 'parameter is set and not null => substitute parameter',
  },
  {
    input: 'result=${parameter:-word}',
    expected: {result: 'word'},
    scope: toMap({parameter: ''}),
    desc: 'parameter is set but null => substitute word',
  },
  {
    input: 'result=${parameter:-word}',
    expected: {result: 'word'},
    desc: 'parameter is unset => substitute word',
  },
  // line 2
  {
    input: 'result=${parameter-word}',
    expected: {result: 'ok'},
    scope: toMap({parameter: 'ok'}),
    desc: 'parameter is set and not null => substitute parameter',
  },
  {
    input: 'result=${parameter-word}',
    expected: {result: ''},
    scope: toMap({parameter: ''}),
    desc: 'parameter is set but null => substitute null',
  },
  {
    input: 'result=${parameter-word}',
    expected: {result: 'word'},
    desc: 'parameter is unset => substitute word',
  },
  // line 3
  {
    input: 'result=${parameter:=word}',
    expected: {result: 'ok'},
    scope: toMap({parameter: 'ok'}),
    desc: 'parameter is set and not null => substitute parameter',
  },
  {
    input: 'result=${parameter:=word}',
    expected: {result: 'word', parameter: 'word'},
    scope: toMap({parameter: ''}),
    desc: 'parameter is set but null => assign word',
  },
  {
    input: 'result=${parameter:=word}',
    expected: {result: 'word', parameter: 'word'},
    desc: 'parameter is unset => assign word',
  },
  // line 4
  {
    input: 'result=${parameter=word}',
    expected: {result: 'ok'},
    scope: toMap({parameter: 'ok'}),
    desc: 'parameter is set and not null => substitute parameter',
  },
  {
    input: 'result=${parameter=word}',
    expected: {result: ''},
    scope: toMap({parameter: ''}),
    desc: 'parameter is set but null => substitute null',
  },
  {
    input: 'result=${parameter=word}',
    expected: {result: 'word', parameter: 'word'},
    desc: 'parameter is unset => assign word',
  },
  // line 5
  {
    input: 'result=${parameter:?word}',
    expected: {result: 'ok'},
    scope: toMap({parameter: 'ok'}),
    desc: 'parameter is set and not null => substitute parameter',
  },
  {
    input: 'result=${parameter:?word}',
    error: UndefinedVariable,
    scope: toMap({parameter: ''}),
    desc: 'parameter is set but null => error',
  },
  {
    input: 'result=${parameter:?word}',
    error: UndefinedVariable,
    desc: 'parameter is unset => error',
  },
  // line 6
  {
    input: 'result=${parameter?word}',
    expected: {result: 'ok'},
    scope: toMap({parameter: 'ok'}),
    desc: 'parameter is set and not null => substitute parameter',
  },
  {
    input: 'result=${parameter?word}',
    expected: {result: ''},
    scope: toMap({parameter: ''}),
    desc: 'parameter is set but null => substitute null',
  },
  {
    input: 'result=${parameter?word}',
    error: UndefinedVariable,
    desc: 'parameter is unset => error',
  },
  // line 7
  {
    input: 'result=${parameter:+word}',
    expected: {result: 'word'},
    scope: toMap({parameter: 'ok'}),
    desc: 'parameter is set and not null => substitute word',
  },
  {
    input: 'result=${parameter:+word}',
    expected: {result: ''},
    scope: toMap({parameter: ''}),
    desc: 'parameter is set but null => substitute null',
  },
  {
    input: 'result=${parameter:+word}',
    expected: {result: ''},
    desc: 'parameter is unset => substitue null',
  },
  // line 8
  {
    input: 'result=${parameter+word}',
    expected: {result: 'word'},
    scope: toMap({parameter: 'ok'}),
    desc: 'parameter is set and not null => substitute word',
  },
  {
    input: 'result=${parameter+word}',
    expected: {result: 'word'},
    scope: toMap({parameter: ''}),
    desc: 'parameter is set but null => substitute word',
  },
  {
    input: 'result=${parameter+word}',
    expected: {result: ''},
    desc: 'parameter is unset => substitue null',
  },
])('expansion operators: $input, $desc', data => {
  assertEval(data)
})

test.each<TestCase>([
  {
    input: 'a=${a:-0} b=${b:-} c=${c:-1}',
    expected: {a: '42', b: '', c: '1'},
    scope: toMap({a: 42, c: ''}),
    desc: ':- operator falls back to provided default',
  },
  {
    input: `a=\${a:-"foo\${b:-"\${c:-nope}"}baz"}`,
    expected: {a: 'foobarbaz'},
    scope: toMap({c: 'bar'}),
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
  assertEval(data)
})