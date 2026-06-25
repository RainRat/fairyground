# Overview
This project uses Fairy-Stockfish and libraries based on it to play and analyze chess variants in the browser.

The main libraries it uses are:
* ffish-es6 for the chess variant logic to generate and validate moves on the board
* fairy-stockfish.wasm as the WebAssembly engine for calculating the best move(s) in a given position
* chessgroundx for the rendering of and user interactions with the chess variant board and pieces
* mithril as a single page application framework

# Development
* Always make sure to call `npm run format:check` and `npm run format` before committing code to ensure that it is properly formatted
* The website is hosted with vercel. Do not change anything about the deployment configuration unless absolutely required or directly requested.
* Do not include other chess or chess variant libraries not based on Fairy-Stockfish, since they will not have the same feature set.
* Only stage and commit files that were added or changed intentionally in scope of the current task.
* At the end of a task make sure that any changes unrelated to the task and temporary debugging code are reverted.

# Local Fairy-Stockfish-X Browser Stack
Fairyground has two browser-side Fairy-Stockfish pieces that can come from different local checkouts:

* `fairy-stockfish.wasm` provides the in-browser search engine artifacts: `stockfish.js`, `stockfish.wasm`, `stockfish.worker.js`, and `uci.js`.
* `Fairy-Stockfish-X` can provide the ffish rules helper artifacts: `tests/js/ffish.js` and `tests/js/ffish.wasm`.

Do not hardcode local checkout paths in committed code. Pass them through environment variables or command-line flags.

```sh
FAIRY_WASM_REPO=/path/to/fairy-stockfish.wasm \
FAIRY_FSX_REPO=/path/to/Fairy-Stockfish-X \
npm run sync-fsx-browser-stack

npm run debug-build
node server.js
```

Equivalent explicit flags:

```sh
node tools/sync_custom_browser_stack.js \
  --wasm-repo /path/to/fairy-stockfish.wasm \
  --ffish-repo /path/to/Fairy-Stockfish-X
```

The sync tool wraps FSX's generated `ffish.js` into a Fairyground-compatible ES module and writes ignored runtime metadata to `node_modules/fairy-stockfish-nnue.wasm/browser-stack.json`, which is copied to `public/lib/browser-stack.json` by `npm run debug-build`. The advanced page displays this fingerprint as the active browser stack. It may contain local paths because it is generated build output and must not be committed.

For very-large-board work, make sure both sides of the browser stack were built with very-large-board support before syncing:

```sh
# Browser engine, from fairy-stockfish.wasm/src
make emscripten_build ARCH=wasm verylargeboards=yes

# Browser ffish rules helper, from Fairy-Stockfish-X/src
make -f Makefile_js build verylargeboards=yes es6=yes
```

After rebuilding and syncing, verify the advanced page console banner reports `VLB`, not only `LB`, and smoke-test affected variants through `ffishlib` in the browser. For example, `linesofaction` and `konane` should have legal moves, `result()` should be `*`, and `isGameOver()` should be false at the starting position.
