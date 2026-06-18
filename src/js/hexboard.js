const HEX_VARIANT_FALLBACK = new Set([
  "glinski-chess",
  "glinski-chess-3shift",
  "glinski-chess-5shift",
  "mccooey-chess",
  "van-gennip-hexchess",
  "van-gennip-small-hexchess",
  "esa-hex",
  "grand-hexachess",
  "hex",
  "hex-10x10",
  "hex-16x16",
  "hex-7x7",
  "minihexchess",
  "misere-hex",
  "y",
]);

let hexBoardStylesInstalled = false;

function getVariantSettingsHexBoardSet() {
  if (
    typeof window !== "undefined" &&
    window.variantsettingsHexBoard instanceof Set
  ) {
    return window.variantsettingsHexBoard;
  }
  return null;
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function makeDataUrl(svg) {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function installHexBoardStyles() {
  if (hexBoardStylesInstalled || typeof document === "undefined") {
    return;
  }
  const style = document.createElement("style");
  style.id = "hexboard-styles";
  style.textContent = `
.hexboard cg-board::before,
.hexboard .cg-wrap cg-board::before {
  background-image: none !important;
}

.hexboard cg-board .hexboard-bg {
  background-image: var(--hex-board-image) !important;
  background-repeat: no-repeat;
  background-position: center center;
  background-size: 100% auto !important;
  inset: 0;
  pointer-events: none;
  position: absolute;
  z-index: 1;
}

.hexboard cg-board piece,
.hexboard cg-board square {
  clip-path: polygon(50% 0, 93.3% 25%, 93.3% 75%, 50% 100%, 6.7% 75%, 6.7% 25%);
  z-index: 3;
}

.hexboard cg-board piece {
  background-position: center center;
  background-repeat: no-repeat;
  background-size: 62% 62%;
}

.hexboard cg-board piece._-piece {
  background-size: 46% 46%;
  opacity: 0.75;
  visibility: visible;
}

.hexboard piece.ghost {
  visibility: hidden !important;
}

.hexboard .cg-wrap coords {
  display: block;
  inset: 0;
  height: 100%;
  z-index: 6;
  width: 100%;
}

.hexboard .cg-wrap coords coord {
  align-items: center;
  display: flex;
  height: 20px;
  justify-content: center;
  padding: 0;
  position: absolute;
  width: 20px;
}

.hexboard cg-board {
  overflow: hidden;
}
`;
  document.head.appendChild(style);
  hexBoardStylesInstalled = true;
}

export function isHexBoardVariant(variant) {
  if (typeof variant !== "string" || variant.length === 0) {
    return false;
  }
  const hexVariants = getVariantSettingsHexBoardSet();
  if (hexVariants && hexVariants.has(variant)) {
    return true;
  }
  return HEX_VARIANT_FALLBACK.has(variant);
}

function buildHexBoardSvg(width, height) {
  const boardWidth = Number.isFinite(width) && width > 0 ? width : 8;
  const boardHeight = Number.isFinite(height) && height > 0 ? height : 8;
  const radius = 36;
  const hexWidth = Math.sqrt(3) * radius;
  const xStep = hexWidth;
  const yStep = radius * 1.5;
  const rowOffset = hexWidth / 2;
  const padding = 6;
  const svgWidth =
    padding * 2 +
    hexWidth +
    (boardWidth - 1) * xStep +
    (boardHeight - 1) * rowOffset;
  const svgHeight = padding * 2 + radius * 2 + (boardHeight - 1) * yStep;
  const lightFill = "#e1cfa5";
  const darkFill = "#9e7d52";
  const border = "#4f3821";
  const stroke = "rgba(37, 26, 15, 0.55)";
  const points = (cx, cy) => {
    const top = cy - radius;
    const midTop = cy - radius / 2;
    const midBottom = cy + radius / 2;
    const bottom = cy + radius;
    return [
      [cx, top],
      [cx + radius * 0.86, midTop],
      [cx + radius * 0.86, midBottom],
      [cx, bottom],
      [cx - radius * 0.86, midBottom],
      [cx - radius * 0.86, midTop],
    ]
      .map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`)
      .join(" ");
  };

  let cells = "";
  for (let row = 0; row < boardHeight; row++) {
    for (let col = 0; col < boardWidth; col++) {
      const cx = padding + hexWidth / 2 + col * xStep + row * rowOffset;
      const cy = padding + radius + row * yStep;
      const fill = (row + col) % 2 === 0 ? lightFill : darkFill;
      cells += `<polygon points="${points(cx, cy)}" fill="${fill}" stroke="${stroke}" stroke-width="1.2"/>`;
    }
  }

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgWidth} ${svgHeight}" width="${svgWidth}" height="${svgHeight}" role="img" aria-label="${escapeXml(
    `${boardWidth} by ${boardHeight} hex board`,
  )}">
  <rect width="100%" height="100%" fill="${border}"/>
  <g shape-rendering="geometricPrecision">
    ${cells}
  </g>
</svg>`;
  return svg;
}

export function buildHexBoardBackground(width, height) {
  return makeDataUrl(buildHexBoardSvg(width, height));
}

export function getHexBoardBackground(width, height) {
  return buildHexBoardBackground(width, height);
}

export function applyHexBoardLayout(container, dimensions) {
  if (!(container instanceof HTMLElement) || !dimensions) {
    return;
  }
  installHexBoardStyles();
  const isHex = !!dimensions.hexBoard;
  container.classList.toggle("hexboard", isHex);
  if (isHex) {
    const boardImage = getHexBoardBackground(
      dimensions.width,
      dimensions.height,
    );
    container.style.setProperty(
      "--hex-board-image",
      `url("${boardImage}")`,
    );
  } else {
    container.style.removeProperty("--hex-board-image");
    container.querySelectorAll(".hexboard-bg").forEach((element) => {
      element.remove();
    });
  }
}

function ensureHexBoardBackground(chessground) {
  const state = chessground?.state;
  const board = state?.dom?.elements?.board;
  if (!state?.dimensions?.hexBoard || !board) {
    return;
  }
  let background = board.querySelector(":scope > .hexboard-bg");
  if (!background) {
    background = document.createElement("div");
    background.className = "hexboard-bg";
    board.insertBefore(background, board.firstChild);
  }
}

function keyToPosition(key) {
  return [key.charCodeAt(0) - 97, key.charCodeAt(1) - 49];
}

function getHexMetrics(width, height) {
  const radius = 36;
  const hexWidth = Math.sqrt(3) * radius;
  const xStep = hexWidth;
  const yStep = radius * 1.5;
  const rowOffset = hexWidth / 2;
  const padding = 6;
  return {
    radius,
    hexWidth,
    xStep,
    yStep,
    rowOffset,
    padding,
    svgWidth:
      padding * 2 + hexWidth + (width - 1) * xStep + (height - 1) * rowOffset,
    svgHeight: padding * 2 + radius * 2 + (height - 1) * yStep,
  };
}

function getHexCenter(key, state, bounds) {
  const [file, rank] = keyToPosition(key);
  const { width, height } = state.dimensions;
  const asWhite = state.orientation === "white";
  const visualFile = asWhite ? file : width - 1 - file;
  const visualRow = asWhite ? height - 1 - rank : rank;
  const metrics = getHexMetrics(width, height);
  const renderedHeight = (metrics.svgHeight * bounds.width) / metrics.svgWidth;
  const renderedTop = (bounds.height - renderedHeight) / 2;
  const centerX =
    metrics.padding +
    metrics.hexWidth / 2 +
    visualFile * metrics.xStep +
    visualRow * metrics.rowOffset;
  const centerY = metrics.padding + metrics.radius + visualRow * metrics.yStep;
  return [
    (centerX * bounds.width) / metrics.svgWidth,
    renderedTop + (centerY * renderedHeight) / metrics.svgHeight,
  ];
}

function alignHexBoardElements(chessground) {
  const state = chessground?.state;
  if (!state?.dimensions?.hexBoard || !state.dom?.elements?.board) {
    return;
  }
  ensureHexBoardBackground(chessground);
  const bounds = state.dom.elements.board.getBoundingClientRect();
  let element = state.dom.elements.board.firstChild;
  while (element) {
    if (
      (element.tagName === "PIECE" || element.tagName === "SQUARE") &&
      typeof element.cgKey === "string" &&
      element.cgKey !== "a0"
    ) {
      const center = getHexCenter(element.cgKey, state, bounds);
      const scale = element.tagName === "SQUARE" ? 0.9 : 1;
      element.style.transform = `translate(${center[0] - element.offsetWidth / 2}px,${center[1] - element.offsetHeight / 2}px) scale(${scale})`;
    }
    element = element.nextSibling;
  }
  alignHexBoardCoordinates(chessground, bounds);
}

function getBoardOffset(chessground, bounds) {
  const container = chessground.state.dom.elements.container;
  const containerBounds = container.getBoundingClientRect();
  return [bounds.left - containerBounds.left, bounds.top - containerBounds.top];
}

function alignHexBoardCoordinates(chessground, bounds) {
  const state = chessground?.state;
  const wrap = state?.dom?.elements?.wrap;
  if (!wrap) {
    return;
  }
  const [offsetX, offsetY] = getBoardOffset(chessground, bounds);
  const cellWidth = bounds.width / state.dimensions.width;
  const cellHeight = bounds.height / state.dimensions.height;
  const labels = wrap.querySelectorAll("coords coord");
  labels.forEach((label) => {
    const text = label.textContent.trim().toLowerCase();
    let center = null;
    let xNudge = 0;
    let yNudge = 0;

    if (/^[a-z]$/.test(text)) {
      center = getHexCenter(`${text}1`, state, bounds);
      yNudge = cellHeight * 0.5;
    } else if (/^[0-9]+$/.test(text)) {
      const rank = Number.parseInt(text, 10);
      if (Number.isFinite(rank)) {
        center = getHexCenter(`g${rank}`, state, bounds);
        center[0] = bounds.width;
        xNudge = 7;
      }
    }

    if (!center) {
      return;
    }
    label.style.left = `${offsetX + center[0] + xNudge - 10}px`;
    label.style.top = `${offsetY + center[1] + yNudge - 10}px`;
  });
}

export function installHexBoardAlignment(chessground) {
  if (!chessground?.state?.dom || chessground.__hexBoardAlignmentInstalled) {
    requestAnimationFrame(() => alignHexBoardElements(chessground));
    return;
  }
  const alignSoon = () => {
    requestAnimationFrame(() => alignHexBoardElements(chessground));
  };
  const wrapDomRedraws = () => {
    const dom = chessground.state.dom;
    if (!dom || dom.__hexBoardRedrawsWrapped) {
      return;
    }
    const originalRedrawNow = dom.redrawNow;
    dom.redrawNow = (skipSvg) => {
      originalRedrawNow(skipSvg);
      alignSoon();
    };
    const originalRedraw = dom.redraw;
    dom.redraw = () => {
      originalRedraw();
      alignSoon();
    };
    dom.__hexBoardRedrawsWrapped = true;
  };
  const originalSet = chessground.set.bind(chessground);
  chessground.set = (config) => {
    originalSet(config);
    alignSoon();
  };
  const originalRedrawAll = chessground.redrawAll.bind(chessground);
  chessground.redrawAll = () => {
    const state = originalRedrawAll();
    wrapDomRedraws();
    alignSoon();
    return state;
  };
  wrapDomRedraws();
  chessground.__hexBoardAlignmentInstalled = true;
  alignSoon();
}
