import { assertEval, type TestCase } from '../utils.ts'

import { Dialect, getParser } from '../../../src/dialects.ts'
import { ParseError, UndefinedVariable } from '../../../src/errors.ts'

for (
  const dialect of [
    Dialect.Posix,
    Dialect.Compose,
    Dialect.Symfony,
  ]
) {
  Deno.test(`${dialect} parameter expansion`, async (t) => {
    // test matrix from POSIX spec:
    // https://pubs.opengroup.org/onlinepubs/9699919799/utilities/V3_chap02.html#tag_18_06_02
    for (
      const data of [
        // line 1
        {
          input: 'result=${parameter:-word}',
          expected: { result: 'ok' },
          env: { parameter: 'ok' },
          desc: 'parameter is set and not null => substitute parameter',
        },
        {
          input: 'result=${parameter:-word}',
          expected: { result: 'word' },
          env: { parameter: '' },
          desc: 'parameter is set but null => substitute word',
        },
        {
          input: 'result=${parameter:-word}',
          expected: { result: 'word' },
          desc: 'parameter is unset => substitute word',
        },
        // line 2
        {
          input: 'result=${parameter-word}',
          expected: { result: 'ok' },
          env: { parameter: 'ok' },
          desc: 'parameter is set and not null => substitute parameter',
        },
        {
          input: 'result=${parameter-word}',
          expected: { result: '' },
          env: { parameter: '' },
          desc: 'parameter is set but null => substitute null',
        },
        {
          input: 'result=${parameter-word}',
          expected: { result: 'word' },
          desc: 'parameter is unset => substitute word',
        },
        // line 3
        {
          input: 'result=${parameter:=word}',
          expected: { result: 'ok' },
          env: { parameter: 'ok' },
          desc: 'parameter is set and not null => substitute parameter',
        },
        {
          input: 'result=${parameter:=word}',
          expected: { result: 'word', parameter: 'word' },
          env: { parameter: '' },
          desc: 'parameter is set but null => assign word',
        },
        {
          input: 'result=${parameter:=word}',
          expected: { result: 'word', parameter: 'word' },
          desc: 'parameter is unset => assign word',
        },
        // line 4
        {
          input: 'result=${parameter=word}',
          expected: { result: 'ok' },
          env: { parameter: 'ok' },
          desc: 'parameter is set and not null => substitute parameter',
        },
        {
          input: 'result=${parameter=word}',
          expected: { result: '' },
          env: { parameter: '' },
          desc: 'parameter is set but null => substitute null',
        },
        {
          input: 'result=${parameter=word}',
          expected: { result: 'word', parameter: 'word' },
          desc: 'parameter is unset => assign word',
        },
        // line 5
        {
          input: 'result=${parameter:?word}',
          expected: { result: 'ok' },
          env: { parameter: 'ok' },
          desc: 'parameter is set and not null => substitute parameter',
        },
        {
          input: 'result=${parameter:?word}',
          error: UndefinedVariable,
          env: { parameter: '' },
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
          expected: { result: 'ok' },
          env: { parameter: 'ok' },
          desc: 'parameter is set and not null => substitute parameter',
        },
        {
          input: 'result=${parameter?word}',
          expected: { result: '' },
          env: { parameter: '' },
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
          expected: { result: 'word' },
          env: { parameter: 'ok' },
          desc: 'parameter is set and not null => substitute word',
        },
        {
          input: 'result=${parameter:+word}',
          expected: { result: '' },
          env: { parameter: '' },
          desc: 'parameter is set but null => substitute null',
        },
        {
          input: 'result=${parameter:+word}',
          expected: { result: '' },
          desc: 'parameter is unset => substitue null',
        },
        // line 8
        {
          input: 'result=${parameter+word}',
          expected: { result: 'word' },
          env: { parameter: 'ok' },
          desc: 'parameter is set and not null => substitute word',
        },
        {
          input: 'result=${parameter+word}',
          expected: { result: 'word' },
          env: { parameter: '' },
          desc: 'parameter is set but null => substitute word',
        },
        {
          input: 'result=${parameter+word}',
          expected: { result: '' },
          desc: 'parameter is unset => substitue null',
        },
      ]
    ) {
      await t.step(`${data.input} when ${data.desc}`, async () => {
        const parser = await getParser(dialect)
        assertEval(data as TestCase, parser)
      })
    }

    for (
      const data of [
        {
          input: 'a=${a?}',
          error: UndefinedVariable,
          desc: '? operator works without explicit error message',
        },
        {
          input: 'a=${b:-foo',
          error: ParseError,
          desc: 'error: unterminated braced expression',
        },
      ]
    ) {
      await t.step(data.desc, async () => {
        const parser = await getParser(dialect)
        assertEval(data as TestCase, parser)
      })
    }
  })
}
