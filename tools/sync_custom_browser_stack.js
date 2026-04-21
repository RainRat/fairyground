#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const wasmRepoArg = process.argv[2];
const wasmRepo = wasmRepoArg || process.env.FAIRY_WASM_REPO;

if (!wasmRepo) {
  console.error(
    [
      "usage: node tools/sync_custom_browser_stack.js /path/to/fairy-stockfish.wasm",
      "",
      "Copies browser artifacts from a locally built fairy-stockfish.wasm checkout into",
      "this Fairyground checkout's node_modules tree.",
      "",
      "You can also set FAIRY_WASM_REPO instead of passing an argument.",
    ].join("\n"),
  );
  process.exit(1);
}

const engineSrc = path.join(wasmRepo, "src", "emscripten", "public");
const ffishJsSrc = path.join(wasmRepo, "tests", "js", "ffish.fairyground.js");
const ffishWasmSrc = path.join(wasmRepo, "tests", "js", "ffish.wasm");

const engineDst = path.join(rootDir, "node_modules", "fairy-stockfish-nnue.wasm");
const ffishDst = path.join(rootDir, "node_modules", "ffish-es6");

for (const requiredPath of [
  engineSrc,
  ffishJsSrc,
  ffishWasmSrc,
  engineDst,
  ffishDst,
]) {
  if (!fs.existsSync(requiredPath)) {
    console.error(`missing required path: ${requiredPath}`);
    process.exit(1);
  }
}

const copy = (src, dst) => fs.copyFileSync(src, dst);

copy(path.join(engineSrc, "stockfish.js"), path.join(engineDst, "stockfish.js"));
copy(
  path.join(engineSrc, "stockfish.wasm"),
  path.join(engineDst, "stockfish.wasm"),
);
copy(
  path.join(engineSrc, "stockfish.worker.js"),
  path.join(engineDst, "stockfish.worker.js"),
);
copy(path.join(engineSrc, "uci.js"), path.join(engineDst, "uci.js"));
copy(ffishJsSrc, path.join(ffishDst, "ffish.js"));
copy(ffishWasmSrc, path.join(ffishDst, "ffish.wasm"));

console.log(`synced custom browser stack from ${wasmRepo}`);
console.log("next steps:");
console.log("  1. npm run debug-build");
console.log("  2. node server.js");
console.log("  3. open http://localhost:5015/public/advanced.html");
