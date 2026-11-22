#!/bin/sh
# usage: tests/run.sh tests/foo.ts [args]  -> bundles with esbuild (like the real build) then runs with node
f=$1; shift
out=/tmp/gm-$(basename $f .ts).mjs
/opt/npm-tools/node_modules/.bin/esbuild $f --bundle --platform=node --format=esm --outfile=$out --log-level=error && node $out "$@"
