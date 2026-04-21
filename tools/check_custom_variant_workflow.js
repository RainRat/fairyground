#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const optionalVariantsPath = process.argv[2];

const fail = (msg) => {
  console.error(`FAIL: ${msg}`);
  process.exitCode = 1;
};

const pass = (msg) => {
  console.log(`PASS: ${msg}`);
};

const read = (rel) => fs.readFileSync(path.join(rootDir, rel), "utf8");

const expectFile = (rel) => {
  const full = path.join(rootDir, rel);
  if (!fs.existsSync(full)) {
    fail(`missing file ${rel}`);
    return false;
  }
  pass(`found ${rel}`);
  return true;
};

const expectText = (rel, snippet, label) => {
  const text = read(rel);
  if (!text.includes(snippet)) {
    fail(`${label} missing in ${rel}`);
    return false;
  }
  pass(`${label} present in ${rel}`);
  return true;
};

const expectVariantSettingsEntry = (variantId) => {
  const text = read("public/variantsettings.txt");
  const found = text
    .split(/\r?\n/)
    .some((line) => line.startsWith(`${variantId}|`));
  if (!found) {
    fail(`variantsettings.txt missing ${variantId}`);
    return false;
  }
  pass(`variantsettings.txt contains ${variantId}`);
  return true;
};

console.log("Checking Fairyground custom variant workflow...");

[
  "node_modules/fairy-stockfish-nnue.wasm/stockfish.js",
  "node_modules/fairy-stockfish-nnue.wasm/stockfish.wasm",
  "node_modules/fairy-stockfish-nnue.wasm/stockfish.worker.js",
  "node_modules/fairy-stockfish-nnue.wasm/uci.js",
  "node_modules/ffish-es6/ffish.js",
  "node_modules/ffish-es6/ffish.wasm",
  "public/variantsettings.txt",
  "public/advanced.html",
  "public/bundle.js",
].forEach(expectFile);

expectText(
  "src/html/advanced.html",
  "Apply VariantPath",
  "inline VariantPath control",
);
expectText(
  "src/html/advanced.html",
  "variantpath-inline",
  "VariantPath input id",
);
expectText(
  "src/js/main.js",
  "loadVariantConfigResiliently",
  "resilient variants.ini loader",
);
expectText(
  "src/js/main.js",
  "window.loadVariantsIniIntoFfish",
  "browser helper variants.ini entrypoint",
);
expectText(
  "src/html/advanced.html",
  "syncDerivedPositionState",
  "advanced derived-state sync",
);

["1d-chess", "battleotk", "ardri", "linesofaction", "kings-valley"].forEach(
  expectVariantSettingsEntry,
);

if (optionalVariantsPath) {
  if (!fs.existsSync(optionalVariantsPath)) {
    fail(`variants.ini path does not exist: ${optionalVariantsPath}`);
  } else {
    const variantsIni = fs.readFileSync(optionalVariantsPath, "utf8");
    ["1d-chess", "battleotk", "ardri"].forEach((variantId) => {
      if (!variantsIni.includes(`[${variantId}`)) {
        fail(`variants.ini missing ${variantId}`);
      } else {
        pass(`variants.ini contains ${variantId}`);
      }
    });
  }
}

console.log("");
console.log("Manual browser smoke test:");
console.log("1. Start `node server.js`.");
console.log("2. Open http://localhost:5015/public/advanced.html and hard refresh.");
console.log("3. Confirm built-in variants appear on startup.");
console.log("4. Load Fairy-Stockfish-X in the three engine slots.");
console.log("5. Load variants.ini.");
console.log("6. If needed, enter the server-side path in the inline VariantPath field and click Apply VariantPath.");
console.log("7. Verify a custom variant such as 1d-chess loads and plays against Engine Black.");
console.log("8. Verify battleotk and ardri still show sane move/result behavior.");

if (process.exitCode) {
  process.exit(process.exitCode);
}
