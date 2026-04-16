#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WASM_REPO="${1:-${FAIRY_WASM_REPO:-}}"

if [[ -z "${WASM_REPO}" ]]; then
  cat <<'EOF' >&2
usage: tools/sync_custom_browser_stack.sh /path/to/fairy-stockfish.wasm

Copies browser artifacts from a locally built fairy-stockfish.wasm checkout into
this Fairyground checkout's node_modules tree.

You can also set FAIRY_WASM_REPO instead of passing an argument.
EOF
  exit 1
fi

ENGINE_SRC="${WASM_REPO}/src/emscripten/public"
FFISH_JS_SRC="${WASM_REPO}/tests/js/ffish.fairyground.js"
FFISH_WASM_SRC="${WASM_REPO}/tests/js/ffish.wasm"

ENGINE_DST="${ROOT_DIR}/node_modules/fairy-stockfish-nnue.wasm"
FFISH_DST="${ROOT_DIR}/node_modules/ffish-es6"

for path in "${ENGINE_SRC}" "${FFISH_JS_SRC}" "${FFISH_WASM_SRC}" "${ENGINE_DST}" "${FFISH_DST}"; do
  if [[ ! -e "${path}" ]]; then
    echo "missing required path: ${path}" >&2
    exit 1
  fi
done

cp "${ENGINE_SRC}/stockfish.js" "${ENGINE_DST}/stockfish.js"
cp "${ENGINE_SRC}/stockfish.wasm" "${ENGINE_DST}/stockfish.wasm"
cp "${ENGINE_SRC}/stockfish.worker.js" "${ENGINE_DST}/stockfish.worker.js"
cp "${ENGINE_SRC}/uci.js" "${ENGINE_DST}/uci.js"
cp "${FFISH_JS_SRC}" "${FFISH_DST}/ffish.js"
cp "${FFISH_WASM_SRC}" "${FFISH_DST}/ffish.wasm"

echo "synced custom browser stack from ${WASM_REPO}"
echo "next steps:"
echo "  1. npm run debug-build"
echo "  2. node server.js"
echo "  3. open http://localhost:5015/public/advanced.html"
