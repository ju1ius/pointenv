import {Source} from '../src/source.js'

describe('Source.positionAt', () => {
  test.each([
    {
      desc: 'offset in single line input',
      input: 'abc',
      offset: 1,
      expected: {line: 1, column: 2},
    },
    {
      desc: 'offset in multi-line input',
      input: 'a\nb\nc',
      offset: 4,
      expected: {line: 3, column: 1},
    },
    {
      desc: 'offset at newline',
      input: 'a\nb\nc',
      offset: 3,
      expected: {line: 2, column: 2},
    }
  ])('$desc', ({input, offset, expected}) => {
    const src = new Source(input)
    expect(src.positionAt(offset)).toEqual(expected)
  })
})
