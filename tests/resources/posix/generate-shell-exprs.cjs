const {execFileSync} = require('node:child_process')
const {readFileSync, writeFileSync} = require('node:fs')


const inputs = JSON.parse(readFileSync(`${__dirname}/shell-exprs.template.json`))
const outputs = inputs.map(({desc, input, setup}) => {
  const expected = evaluateShellExpr(input, setup)
  return {
    desc,
    setup,
    input,
    expected,
  }
})
writeFileSync(`${__dirname}/shell-exprs.json`, JSON.stringify(outputs, null, 2))


function evaluateShellExpr(input, setup = '') {
  const script = `\
${setup}
__TEST_EXPR__=${input}
echo -n "\${__TEST_EXPR__}"
`
  return execFileSync('/bin/sh', ['-c', script], {encoding: 'utf-8'})
}
