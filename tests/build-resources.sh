#!/bin/sh

__DIR__="$(dirname "$(realpath "$0")")"
RESOURCES="${__DIR__}/resources"


node "${RESOURCES}/posix/generate.cjs"
/bin/sh "${RESOURCES}/compose/generate.sh"
php "${RESOURCES}/php/generate.php"
