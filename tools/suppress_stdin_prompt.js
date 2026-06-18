const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");

function replaceInFile(relativePath, replacements) {
  const filePath = path.join(root, relativePath);
  if (!fs.existsSync(filePath)) {
    return;
  }

  let source = fs.readFileSync(filePath, "utf8");
  let next = source;

  for (const [from, to] of replacements) {
    next = next.split(from).join(to);
  }

  if (next !== source) {
    fs.writeFileSync(filePath, next);
  }
}

const ffishPrompt = `function FS_stdin_getChar() {
      if (!FS_stdin_getChar_buffer.length) {
        var result = null;
        if (typeof window != 'undefined' &&
          typeof window.prompt == 'function') {
          result = window.prompt('Input: ');  // returns null on cancel
          if (result !== null) {
            result += '\\n';
          }
        } else if (typeof readline == 'function') {
          result = readline();
          if (result !== null) {
            result += '\\n';
          }
        }
        if (!result) {
          return null;
        }
        FS_stdin_getChar_buffer = intArrayFromString(result, true);
      }
      return FS_stdin_getChar_buffer.shift();
    }`;

const ffishNoPrompt = `function FS_stdin_getChar() {
      if (!FS_stdin_getChar_buffer.length) return null;
      return FS_stdin_getChar_buffer.shift();
    }`;

replaceInFile("node_modules/ffish-es6/ffish.js", [
  [ffishPrompt, ffishNoPrompt],
]);

const stockfishPrompt =
  'else globalThis.window?.prompt&&(a=window.prompt("Input: "),null!==a&&(a+="\\n"));';
const stockfishNoPrompt = "else a=null;";

for (const relativePath of [
  "node_modules/fairy-stockfish-nnue.wasm/stockfish.js",
  "node_modules/fairy-stockfish-nnue.wasm/stockfish.worker.js",
  "public/lib/stockfish.js",
  "public/lib/stockfish.worker.js",
]) {
  replaceInFile(relativePath, [[stockfishPrompt, stockfishNoPrompt]]);
}

const rectangularKeyAtDomPos = `export function getKeyAtDomPos(pos, asWhite, bounds, bd) {
    let file = Math.floor((bd.width * (pos[0] - bounds.left)) / bounds.width);
    if (!asWhite)
        file = bd.width - 1 - file;
    let rank = bd.height - 1 - Math.floor((bd.height * (pos[1] - bounds.top)) / bounds.height);
    if (!asWhite)
        rank = bd.height - 1 - rank;
    return file >= 0 && file < bd.width && rank >= 0 && rank < bd.height ? pos2key([file, rank]) : undefined;
}`;

const hexAwareKeyAtDomPos = `export function getKeyAtDomPos(pos, asWhite, bounds, bd) {
    if (bd.hexBoard) {
        const radius = 36;
        const hexWidth = Math.sqrt(3) * radius;
        const xStep = hexWidth;
        const yStep = radius * 1.5;
        const rowOffset = hexWidth / 2;
        const padding = 6;
        const svgWidth = padding * 2 + hexWidth + (bd.width - 1) * xStep + (bd.height - 1) * rowOffset;
        const svgHeight = padding * 2 + radius * 2 + (bd.height - 1) * yStep;
        const renderedHeight = (svgHeight * bounds.width) / svgWidth;
        const renderedTop = (bounds.height - renderedHeight) / 2;
        const scale = bounds.width / svgWidth;
        const localX = pos[0] - bounds.left;
        const localY = pos[1] - bounds.top;
        if (localX < 0 || localX > bounds.width || localY < renderedTop || localY > renderedTop + renderedHeight)
            return;
        let bestKey;
        let bestDistance = Infinity;
        for (let rank = 0; rank < bd.height; rank++) {
            for (let file = 0; file < bd.width; file++) {
                const visualFile = asWhite ? file : bd.width - 1 - file;
                const visualRow = asWhite ? bd.height - 1 - rank : rank;
                const centerX = (padding + hexWidth / 2 + visualFile * xStep + visualRow * rowOffset) * scale;
                const centerY = renderedTop + (padding + radius + visualRow * yStep) * scale;
                const distance = distanceSq([localX, localY], [centerX, centerY]);
                if (distance < bestDistance) {
                    bestDistance = distance;
                    bestKey = pos2key([file, rank]);
                }
            }
        }
        return bestDistance <= Math.pow(radius * scale * 1.05, 2) ? bestKey : undefined;
    }
    let file = Math.floor((bd.width * (pos[0] - bounds.left)) / bounds.width);
    if (!asWhite)
        file = bd.width - 1 - file;
    let rank = bd.height - 1 - Math.floor((bd.height * (pos[1] - bounds.top)) / bounds.height);
    if (!asWhite)
        rank = bd.height - 1 - rank;
    return file >= 0 && file < bd.width && rank >= 0 && rank < bd.height ? pos2key([file, rank]) : undefined;
}`;

replaceInFile("node_modules/chessgroundx/board.js", [
  [rectangularKeyAtDomPos, hexAwareKeyAtDomPos],
]);

const rectangularPosToTranslate = `export const posToTranslate = (bounds, bd) => (pos, asWhite) => [
    ((asWhite ? pos[0] : bd.width - 1 - pos[0]) * bounds.width) / bd.width,
    ((asWhite ? bd.height - 1 - pos[1] : pos[1]) * bounds.height) / bd.height,
];`;

const hexAwarePosToTranslate = `function hexRenderedMetrics(bounds, bd) {
    const radius = 36;
    const hexWidth = Math.sqrt(3) * radius;
    const xStep = hexWidth;
    const yStep = radius * 1.5;
    const rowOffset = hexWidth / 2;
    const padding = 6;
    const svgWidth = padding * 2 + hexWidth + (bd.width - 1) * xStep + (bd.height - 1) * rowOffset;
    const svgHeight = padding * 2 + radius * 2 + (bd.height - 1) * yStep;
    const renderedHeight = (svgHeight * bounds.width) / svgWidth;
    const renderedTop = (bounds.height - renderedHeight) / 2;
    const scale = bounds.width / svgWidth;
    return { radius, hexWidth, xStep, yStep, rowOffset, padding, renderedTop, scale };
}
function hexCenter(pos, asWhite, bounds, bd) {
    const metrics = hexRenderedMetrics(bounds, bd);
    const visualFile = asWhite ? pos[0] : bd.width - 1 - pos[0];
    const visualRow = asWhite ? bd.height - 1 - pos[1] : pos[1];
    return [
        (metrics.padding + metrics.hexWidth / 2 + visualFile * metrics.xStep + visualRow * metrics.rowOffset) * metrics.scale,
        metrics.renderedTop + (metrics.padding + metrics.radius + visualRow * metrics.yStep) * metrics.scale,
    ];
}
export const posToTranslate = (bounds, bd) => (pos, asWhite) => {
    if (bd.hexBoard) {
        const center = hexCenter(pos, asWhite, bounds, bd);
        return [
            center[0] - bounds.width / (2 * bd.width),
            center[1] - bounds.height / (2 * bd.height),
        ];
    }
    return [
        ((asWhite ? pos[0] : bd.width - 1 - pos[0]) * bounds.width) / bd.width,
        ((asWhite ? bd.height - 1 - pos[1] : pos[1]) * bounds.height) / bd.height,
    ];
};`;

const rectangularComputeSquareCenter = `export function computeSquareCenter(key, asWhite, bounds, bd) {
    const pos = key2pos(key);
    if (!asWhite) {
        pos[0] = bd.width - 1 - pos[0];
        pos[1] = bd.height - 1 - pos[1];
    }
    return [
        bounds.left + (bounds.width * (pos[0] + 0.5)) / bd.width,
        bounds.top + (bounds.height * (bd.height - pos[1] - 0.5)) / bd.height,
    ];
}`;

const hexAwareComputeSquareCenter = `export function computeSquareCenter(key, asWhite, bounds, bd) {
    const pos = key2pos(key);
    if (bd.hexBoard) {
        const center = hexCenter(pos, asWhite, bounds, bd);
        return [bounds.left + center[0], bounds.top + center[1]];
    }
    if (!asWhite) {
        pos[0] = bd.width - 1 - pos[0];
        pos[1] = bd.height - 1 - pos[1];
    }
    return [
        bounds.left + (bounds.width * (pos[0] + 0.5)) / bd.width,
        bounds.top + (bounds.height * (bd.height - pos[1] - 0.5)) / bd.height,
    ];
}`;

replaceInFile("node_modules/chessgroundx/util.js", [
  [rectangularPosToTranslate, hexAwarePosToTranslate],
  [rectangularComputeSquareCenter, hexAwareComputeSquareCenter],
]);
