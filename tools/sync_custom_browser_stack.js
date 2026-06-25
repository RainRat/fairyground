#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const rootDir = path.resolve(__dirname, "..");

const args = process.argv.slice(2);
const options = {};
for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  if (arg === "--wasm-repo" || arg === "--wasm") {
    options.wasmRepo = args[++i];
  } else if (arg === "--ffish-repo" || arg === "--ffish" || arg === "--fsx") {
    options.ffishRepo = args[++i];
  } else if (arg === "--ffish-js") {
    options.ffishJs = args[++i];
  } else if (arg === "--ffish-wasm") {
    options.ffishWasm = args[++i];
  } else if (arg === "--help" || arg === "-h") {
    options.help = true;
  } else if (!options.wasmRepo) {
    options.wasmRepo = arg;
  } else {
    console.error(`unknown argument: ${arg}`);
    process.exit(1);
  }
}

const wasmRepo = options.wasmRepo || process.env.FAIRY_WASM_REPO;
const ffishRepo =
  options.ffishRepo || process.env.FAIRY_FFISH_REPO || process.env.FAIRY_FSX_REPO;

if (options.help || !wasmRepo) {
  console.error(
    [
      "usage: node tools/sync_custom_browser_stack.js --wasm-repo /path/to/fairy-stockfish.wasm [--ffish-repo /path/to/Fairy-Stockfish-X]",
      "",
      "Copies browser artifacts from a locally built fairy-stockfish.wasm checkout into",
      "this Fairyground checkout's node_modules tree.",
      "",
      "Options:",
      "  --wasm-repo PATH   Source for stockfish.js, stockfish.wasm, stockfish.worker.js, uci.js",
      "  --ffish-repo PATH  Source for tests/js/ffish.js and tests/js/ffish.wasm",
      "  --ffish-js PATH    Explicit ffish.js source, already built by Emscripten",
      "  --ffish-wasm PATH  Explicit ffish.wasm source",
      "",
      "Environment alternatives: FAIRY_WASM_REPO, FAIRY_FFISH_REPO, FAIRY_FSX_REPO.",
    ].join("\n"),
  );
  process.exit(options.help ? 0 : 1);
}

const engineSrc = path.join(wasmRepo, "src", "emscripten", "public");
const ffishRoot = ffishRepo || wasmRepo;
const defaultFfishJsSrc = path.join(ffishRoot, "tests", "js", "ffish.js");
const legacyFfishJsSrc = path.join(ffishRoot, "tests", "js", "ffish.fairyground.js");
const ffishJsSrc =
  options.ffishJs ||
  (fs.existsSync(defaultFfishJsSrc) ? defaultFfishJsSrc : legacyFfishJsSrc);
const ffishWasmSrc =
  options.ffishWasm || path.join(ffishRoot, "tests", "js", "ffish.wasm");

const engineDst = path.join(rootDir, "node_modules", "fairy-stockfish-nnue.wasm");
const ffishDst = path.join(rootDir, "node_modules", "ffish-es6");
const ffishCompatDst = path.join(ffishDst, "ffish.js");

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
const gitInfo = (repo) => {
  const cwd = path.resolve(repo);
  try {
    const commit = execFileSync("git", ["rev-parse", "--short", "HEAD"], {
      cwd,
      encoding: "utf8",
    }).trim();
    const branch = execFileSync("git", ["branch", "--show-current"], {
      cwd,
      encoding: "utf8",
    }).trim();
    const status = execFileSync("git", ["status", "--porcelain"], {
      cwd,
      encoding: "utf8",
    }).trim();
    return {
      path: cwd,
      branch: branch || null,
      commit,
      dirty: status.length > 0,
    };
  } catch {
    return { path: cwd, branch: null, commit: null, dirty: null };
  }
};
const artifactInfo = (src) => {
  const stat = fs.statSync(src);
  return {
    source: path.resolve(src),
    bytes: stat.size,
    mtime: stat.mtime.toISOString(),
  };
};

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
execFileSync(
  process.execPath,
  [path.join(__dirname, "build_ffish_fairyground_compat.js"), ffishJsSrc, ffishCompatDst],
  { stdio: "inherit" },
);
copy(ffishWasmSrc, path.join(ffishDst, "ffish.wasm"));

const metadata = {
  generatedAt: new Date().toISOString(),
  engine: {
    repo: gitInfo(wasmRepo),
    artifacts: {
      js: artifactInfo(path.join(engineSrc, "stockfish.js")),
      wasm: artifactInfo(path.join(engineSrc, "stockfish.wasm")),
      worker: artifactInfo(path.join(engineSrc, "stockfish.worker.js")),
      uci: artifactInfo(path.join(engineSrc, "uci.js")),
    },
  },
  ffish: {
    repo: gitInfo(ffishRoot),
    artifacts: {
      js: artifactInfo(ffishJsSrc),
      wasm: artifactInfo(ffishWasmSrc),
    },
  },
};
const metadataText = `${JSON.stringify(metadata, null, 2)}\n`;
fs.writeFileSync(path.join(engineDst, "browser-stack.json"), metadataText);
const publicLib = path.join(rootDir, "public", "lib");
if (fs.existsSync(publicLib)) {
  fs.writeFileSync(path.join(publicLib, "browser-stack.json"), metadataText);
}

console.log(`synced custom browser engine from ${wasmRepo}`);
console.log(`synced custom ffish rules from ${ffishRoot}`);
console.log("next steps:");
console.log("  1. npm run debug-build");
console.log("  2. node server.js");
console.log("  3. open http://localhost:5015/public/advanced.html");
