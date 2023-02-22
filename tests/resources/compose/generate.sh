#!/bin/sh

DIR="$(dirname "$(realpath "$0")")"

cd "${DIR}" || exit 1

for env_file in *.env;
do
  cid="$(ENV_FILE="${env_file}" docker compose run -dT --rm pointenv /bin/sh)"
  docker inspect "${cid}" \
    | jq -r '.[].Config.Env
      | map(
        capture("^(?<key>[^=]+)=(?<value>.*)$"; "ms")
        | select(.key != "PATH")
      )
      | sort_by(.key)
    ' \
    > "${env_file}.expected.json"
  docker kill "${cid}"
done
