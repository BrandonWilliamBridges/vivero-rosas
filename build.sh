#!/bin/sh
# Builds docs/ (what GitHub Pages serves) from index.html (the artifact source).
set -e
cd "$(dirname "$0")"
mkdir -p docs
rm -rf docs/img && cp -R img docs/img
{
  printf '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n<style>html{box-sizing:border-box}body{margin:0;padding:0}img{max-width:100%%}[hidden]:not([hidden=until-found i]){display:none!important}</style>\n'
  sed -n '1,/^<\/script>$/p' index.html
  printf '</head>\n<body style="margin:0">\n'
  sed -n '/^<header class="bar">/,$p' index.html
  printf '\n</body>\n</html>\n'
} > docs/index.html
echo "built docs/index.html ($(wc -c < docs/index.html) bytes)"
