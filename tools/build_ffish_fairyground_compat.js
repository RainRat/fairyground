#!/usr/bin/env node

const fs = require("fs/promises");
const path = require("path");
const { transform } = require("esbuild");

const input = process.argv[2];
const output = process.argv[3];

if (!input || !output) {
  console.error(
    "usage: node tools/build_ffish_fairyground_compat.js /path/to/ffish.js /path/to/output.js",
  );
  process.exit(1);
}

async function main() {
  let text = await fs.readFile(path.resolve(input), "utf8");
  const isModernModule = text.includes("export default Module;");

  text = text
    .replace(
      'var ENVIRONMENT_IS_NODE=globalThis.process?.versions?.node&&globalThis.process?.type!="renderer";',
      "var ENVIRONMENT_IS_NODE=false;",
    )
    .replace(
      "var _scriptName=import.meta.url;",
      'var _scriptName=((globalThis.document?.currentScript)?.src)||"";',
    )
    .replace(
      'return new URL("ffish.wasm",import.meta.url).href',
      'return locateFile("ffish.wasm")',
    )
    .replaceAll('var fs=require("node:fs");', "var fs=null;")
    .replaceAll('var nodeCrypto=require("node:crypto");', "var nodeCrypto=null;");

  if (!isModernModule) {
    text = text
      .replace(
        'var Module=typeof Module!="undefined"?Module:{};',
        [
          "Module = Module || {};",
          "var readyPromiseResolve,readyPromiseReject;",
          'Module["ready"]=new Promise(function(resolve,reject){readyPromiseResolve=resolve;readyPromiseReject=reject});',
        ].join(""),
      )
      .replace(
        'initRuntime();Module["onRuntimeInitialized"]?.();postRun()',
        'initRuntime();readyPromiseResolve(Module);Module["onRuntimeInitialized"]?.();postRun()',
      );

    text = [
      "var ModuleFactory = function(Module) {",
      text,
      'return Module["ready"];',
      "};",
      "export default ModuleFactory;",
      "",
    ].join("\n");
  }

  const transformed = await transform(text, {
    format: "esm",
    platform: "browser",
    target: "es2015",
    loader: "js",
    logLevel: "silent",
  });

  await fs.writeFile(path.resolve(output), transformed.code);
  console.log(`Wrote Fairyground-compatible ffish bundle to ${output}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
