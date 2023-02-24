# @ju1ius/pointenv

[![codecov](https://codecov.io/gh/ju1ius/pointenv/branch/main/graph/badge.svg?token=f5TpbMGLy7)](https://codecov.io/gh/ju1ius/pointenv)

Polyglot dotenv parser and evaluator.

## Installation

```sh
npm install @ju1ius/pointenv
```

## Supported dialects

* [posix](https://github.com/ko1nksm/shdotenv/blob/main/docs/specification.md)
* [docker-compose](https://docs.docker.com/compose/environment-variables/env-file/)
* [symfony/dotenv](https://github.com/symfony/dotenv)

The formal `dotenv` syntax for this project is `posix` only.

The `posix` dialect is a subset of the POSIX shell syntax
and is compatible with shell scripts.
It was first introduced by the [shdotenv](https://github.com/ko1nksm/shdotenv) project.

Support for other `dotenv` syntax dialects is included for interoperability purposes.
Compatibility will be improved gradually, but is not always 100% possible (nor always desirable).


## Usage

The default entrypoint for this module parses and evaluates
the given files in order, then injects the resulting variables
into the `process.env` global object.

It returns a `Map<string, string>` object containing the variables that have been injected into `process.env`.

```ts
import pointenv from '@ju1ius/pointenv'

const applied = await pointenv(['.env', '.env.local'])
console.log(applied)
```

Variables that are already present in the environment have precedence
over those specified in the dotenv files, unless the `override` option is `true`:

```ts
await pointenv(['.env'], {override: true})
```

If an `env` option is provided,
the variable resolution will use that instead of `process.env`.

This can be used i.e. for providing defaults for when a variable is not set in the environment.

```sh
# .env
BAR="${FOO:-not found}"
```

```ts
const env = await pointenv(['.env'], {
  env: {
    FOO: 'bar',
    ...process.env,
  }
})
console.log(env.get('BAR')) // 'bar'
```

If you just want to parse and evaluate the files without injecting anything into `process.env`, use the `load` function:

```ts
import {load} from '@ju1ius/pointenv'

const env = await load(['.env'])
// env is a Map<string, string> containing all the variables
// found in the provided files
console.log(env)
```

### Using alternative dialects

The `dialect` option can be set to one of the supported alternative dialects:

```ts
import pointenv, {load, Dialect} from '@ju1ius/pointenv'
// use the docker-compose dialect
await pointenv(['.env'], {dialect: Dialect.Compose})
// use the symfony dialect
await load(['.env'], {dialect: Dialect.Symfony})
```
