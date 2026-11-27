#!/usr/bin/env sh
cd "$(dirname "$0")" || exit 1

if ! command -v node >/dev/null 2>&1; then
  echo ""
  echo "  O PratoFeito precisa do Node.js 22.13 ou mais novo."
  echo "  Instale a versão LTS em https://nodejs.org e rode este arquivo de novo."
  echo ""
  if command -v xdg-open >/dev/null 2>&1; then xdg-open https://nodejs.org >/dev/null 2>&1 &
  elif command -v open >/dev/null 2>&1; then open https://nodejs.org; fi
  exit 1
fi

exec node server/index.js --open
