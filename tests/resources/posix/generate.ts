type Input = {
  input: string
  desc: string
  setup?: string
}

const inputs = loadDataSet()
const outputs = inputs.map(({ desc, input, setup }) => {
  const expected = evaluateShellExpr(input, setup)
  return {
    desc,
    setup,
    input,
    expected,
  }
})

Deno.writeTextFileSync(`${__dirname}/shell-exprs.json`, JSON.stringify(outputs, null, 2))

function evaluateShellExpr(input: string, setup = '') {
  const script = `\
${setup}
__TEST_EXPR__=${input}
printf '%s' "\${__TEST_EXPR__}"
`
  const { stdout } = new Deno.Command('/bin/sh', { args: ['-c', script], clearEnv: true })
    .outputSync()
  return new TextDecoder().decode(stdout)
}

function loadDataSet(): Input[] {
  return [
    {
      input: 'a\\b',
      desc: 'unknown escaped char in unquoted value',
    },
    {
      input: `"a\\b"`,
      desc: 'unknown escaped char in doube-quoted value',
    },
    {
      input: `a'b'"c"$'d'$"e"`,
      desc: 'unquoted, concatenate quoting styles',
    },
    {
      input: `"a'b'$'c'$\\"d\\""`,
      desc: 'quoted, concatenate quoting styles',
    },
    {
      input: `a\\\nb`,
      desc: 'unquoted, line continuation',
    },
    {
      input: `"a\\\n  b"`,
      desc: 'double-quoted, line continuation + whitespace',
    },
    {
      input: `'a\\\n  b'`,
      desc: 'single-quoted, line continuation + whitespace',
    },
    {
      input: '${NOPE:-foo\\\n    bar}',
      desc: 'line continuation in unquoted expansion',
    },
    {
      input: `"\${NOPE:-foo\\\n    bar}"`,
      desc: 'line continuation in double-quoted expansion',
    },
    {
      input: '\'${NOPE:-foo\\\n    bar}\'',
      desc: 'no line continuations in single-quoted expansions',
    },
    {
      input: `"\${NOPE:-'foo\\\n    bar'}"`,
      desc: 'line continuation in single-quoted expansion in double-quoted string',
    },
    {
      input: `\${NOPE:-fo\\o}`,
      desc: 'unknown escaped char in unquoted expansion',
    },
    {
      input: `"\${NOPE:-fo\\o}"`,
      desc: 'unknown escaped char in quoted expansion',
    },
  ]
}
