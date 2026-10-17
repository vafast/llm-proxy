#!/bin/sh
# Vercel build: bundle the app (incl. deps) into one ESM file the function imports.
set -e
npx esbuild src/index.ts --bundle --platform=node --target=node22 --format=esm --outfile=dist/vercel.mjs --external:pg-native --external:react --external:react-dom --external:react-dom/server --external:vue --external:@vue/server-renderer \
  --banner:js="import{createRequire as __cr}from'module';const require=__cr(import.meta.url);"
mkdir -p public && echo llm-proxy > public/.keep.txt
