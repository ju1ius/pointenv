
import {Dialect, getParser} from '../../../src/dialects.js'
import {ParseError, UndefinedVariable} from '../../../src/errors.js'

import {assertEval, TestCase} from '../utils.js'

const dialects = [
  Dialect.Posix,
  Dialect.Compose,
  Dialect.Symfony,
]

describe.each(dialects)('%p parameter expansion', (dialect) => {
  // test matrix from POSIX spec:
  // https://pubs.opengroup.org/onlinepubs/9699919799/utilities/V3_chap02.html#tag_18_06_02
  test.each<TestCase>([
    // line 1
    {
      input: 'result=${parameter:-word}',
      expected: {result: 'ok'},
      scope: {parameter: 'ok'},
      desc: 'parameter is set and not null => substitute parameter',
    },
    {
      input: 'result=${parameter:-word}',
      expected: {result: 'word'},
      scope: {parameter: ''},
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
      scope: {parameter: 'ok'},
      desc: 'parameter is set and not null => substitute parameter',
    },
    {
      input: 'result=${parameter-word}',
      expected: {result: ''},
      scope: {parameter: ''},
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
      scope: {parameter: 'ok'},
      desc: 'parameter is set and not null => substitute parameter',
    },
    {
      input: 'result=${parameter:=word}',
      expected: {result: 'word', parameter: 'word'},
      scope: {parameter: ''},
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
      scope: {parameter: 'ok'},
      desc: 'parameter is set and not null => substitute parameter',
    },
    {
      input: 'result=${parameter=word}',
      expected: {result: ''},
      scope: {parameter: ''},
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
      scope: {parameter: 'ok'},
      desc: 'parameter is set and not null => substitute parameter',
    },
    {
      input: 'result=${parameter:?word}',
      error: UndefinedVariable,
      scope: {parameter: ''},
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
      scope: {parameter: 'ok'},
      desc: 'parameter is set and not null => substitute parameter',
    },
    {
      input: 'result=${parameter?word}',
      expected: {result: ''},
      scope: {parameter: ''},
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
      scope: {parameter: 'ok'},
      desc: 'parameter is set and not null => substitute word',
    },
    {
      input: 'result=${parameter:+word}',
      expected: {result: ''},
      scope: {parameter: ''},
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
      scope: {parameter: 'ok'},
      desc: 'parameter is set and not null => substitute word',
    },
    {
      input: 'result=${parameter+word}',
      expected: {result: 'word'},
      scope: {parameter: ''},
      desc: 'parameter is set but null => substitute word',
    },
    {
      input: 'result=${parameter+word}',
      expected: {result: ''},
      desc: 'parameter is unset => substitue null',
    },
  ])('$input when $desc', async (data) => {
    const parser = await getParser(dialect)
    assertEval(data, parser)
  })

  test.each<TestCase>([
    {
      input: 'a=${b:-foo',
      error: ParseError,
      desc: 'unterminate braced expression',
    },
  ])('$desc', async (data) => {
    const parser = await getParser(dialect)
    assertEval(data, parser)
  })
})

