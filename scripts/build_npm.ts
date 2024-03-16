import { fs } from '../tests/deps.ts'
import { build, emptyDir } from 'https://deno.land/x/dnt@0.40.0/mod.ts'

await emptyDir('./npm')

// copy test resources
await fs.copy('tests/resources', 'npm/esm/tests/resources', {
  overwrite: true,
})
await fs.copy('dotenv-spec/tests', 'npm/esm/dotenv-spec/tests', {
  overwrite: true,
})

await build({
  entryPoints: ['./mod.ts'],
  outDir: './npm',
  typeCheck: 'both',
  scriptModule: false,
  rootTestDir: './tests',
  shims: {
    // see JS docs for overview and more options
    deno: true,
  },
  package: {
    // package.json properties
    name: '@ju1ius/pointenv',
    version: Deno.args[0]?.replace(/^v/, ''),
    description: 'Polyglot dotenv parser and evaluator.',
    author: 'ju1ius <jules.bernable@gmail.com>',
    license: 'MIT',
    repository: {
      type: 'git',
      url: 'git+https://github.com/ju1ius/pointenv.git',
    },
    bugs: {
      url: 'https://github.com/ju1ius/pointenv.git/issues',
    },
    engines: { node: '>=18.0' },
    keywords: [
      'dotenv',
      'parser',
      'expansion',
      'shell',
      'variable',
      'posix',
    ],
  },
  postBuild() {
    Deno.copyFileSync('LICENSE', 'npm/LICENSE')
    Deno.copyFileSync('README.md', 'npm/README.md')
    processNpmIgnore()
  },
})

function processNpmIgnore() {
  const file = 'npm/.npmignore'
  const lines = Deno.readTextFileSync(file)
    .split('\n')
    .filter(entry => !entry.startsWith('esm/src/'))
    .concat([
      'esm/dotenv-spec',
      'esm/tests/resources',
    ])
  Deno.writeTextFileSync(file, lines.join('\n'))
}
