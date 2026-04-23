const fs = require("fs");
const { test, expect } = require("@playwright/test");
const path = require("path");

const DEFAULT_FSF_X_SRC_DIR = path.resolve(
  __dirname,
  "../../Fairy-Stockfish-X/src",
);
const FSF_X_SRC_DIR = process.env.FSF_X_SRC || DEFAULT_FSF_X_SRC_DIR;
const FSF_X_BINARY =
  process.env.FSF_X_BIN || path.join(FSF_X_SRC_DIR, "stockfish");
const FSF_X_VARIANTS =
  process.env.FSF_X_VARIANTS || path.join(FSF_X_SRC_DIR, "variants.ini");

function skipIfMissing(filePath, label) {
  test.skip(!fs.existsSync(filePath), `${label} not found: ${filePath}`);
}

async function uploadVariantsIni(page) {
  skipIfMissing(FSF_X_VARIANTS, "Fairy-Stockfish-X variants.ini");
  await page.setInputFiles("#variants-ini", path.resolve(FSF_X_VARIANTS));
}

async function waitForVariantOption(page, value) {
  await page.waitForFunction(
    (targetValue) => {
      const variantDropdown = document.querySelector("#dropdown-variant");
      if (!variantDropdown) {
        return false;
      }
      return Array.from(variantDropdown.options).some(
        (option) => option.value === targetValue,
      );
    },
    value,
    { timeout: 20000 },
  );
}

async function selectVariantBySearchingTypes(page, targetValue) {
  const variantTypeValues = await page.$$eval(
    "#dropdown-varianttype option",
    (options) => options.map((option) => option.value),
  );

  for (const typeValue of variantTypeValues) {
    await page.selectOption("#dropdown-varianttype", typeValue);
    await page.waitForTimeout(100);
    const found = await page.$eval(
      "#dropdown-variant",
      (dropdown, value) =>
        Array.from(dropdown.options).some((option) => option.value === value),
      targetValue,
    );
    if (found) {
      return true;
    }
  }

  return false;
}

async function connectExternalEngineBackend(page) {
  page.once("dialog", (dialog) => dialog.accept("5016"));
  await page.getByRole("button", { name: "CONNECT" }).click();
  await page.waitForFunction(
    () =>
      window.fairyground &&
      window.fairyground.BinaryEngineFeature &&
      window.fairyground.BinaryEngineFeature.WebSocketStatus === "CONNECTED",
    { timeout: 15000 },
  );
}

async function loadBlackExternalEngine(page) {
  skipIfMissing(FSF_X_BINARY, "Fairy-Stockfish-X binary");
  await page.evaluate(
    async ({ command, workingDirectory }) => {
      const fge = window.fairyground.BinaryEngineFeature;
      window.__pwEngineLoaded = null;
      window.__pwEngineError = null;

      const engine = new fge.Engine(
        "playwright-fsfx-black",
        command,
        workingDirectory,
        "UCI",
        [{ name: "VariantPath", current: "<empty>" }],
        "BLACK",
        fge.load_engine_timeout,
        fge.ws,
      );
      fge.second_engine = engine;

      await new Promise((resolve) => {
        engine.Load(
          (name, author) => {
            window.__pwEngineLoaded = { name, author };
            resolve();
          },
          (err) => {
            window.__pwEngineError = String(err);
            resolve();
          },
        );
      });
    },
    { command: FSF_X_BINARY, workingDirectory: FSF_X_SRC_DIR },
  );

  await page.waitForFunction(
    () => window.__pwEngineLoaded !== null || window.__pwEngineError !== null,
    { timeout: 20000 },
  );

  const engineError = await page.evaluate(() => window.__pwEngineError);
  expect(engineError).toBeNull();
}

test("built-in variants appear on startup", async ({ page }) => {
  await page.goto("/public/advanced.html");
  await waitForVariantOption(page, "chess");
  await expect(page.locator("#dropdown-variant")).toContainText("Chess");
});

test("uploading variants.ini exposes 1d-chess", async ({ page }) => {
  await page.goto("/public/advanced.html");
  await waitForVariantOption(page, "chess");

  await uploadVariantsIni(page);

  await page.waitForFunction(
    () =>
      !!window.ffishlib &&
      typeof window.ffishlib.variants == "function" &&
      window.ffishlib.variants().split(" ").includes("1d-chess"),
    { timeout: 30000 },
  );

  const found = await selectVariantBySearchingTypes(page, "1d-chess");
  expect(found).toBeTruthy();
});

test("amazons is not declared drawn on startup", async ({ page }) => {
  await page.goto("/public/advanced.html");
  await waitForVariantOption(page, "amazons");

  const found = await selectVariantBySearchingTypes(page, "amazons");
  expect(found).toBeTruthy();
  await page.selectOption("#dropdown-variant", "amazons");

  await page.waitForFunction(
    () => document.querySelector("#dropdown-variant")?.value === "amazons",
    { timeout: 10000 },
  );

  await expect(page.locator("#gameresult")).not.toHaveValue("1/2-1/2");
});

test("pass button handles literal 0000 pass moves", async ({ page }) => {
  await page.goto("/public/advanced.html");
  await uploadVariantsIni(page);
  await page.waitForFunction(
    () =>
      !!window.ffishlib &&
      typeof window.ffishlib.variants == "function" &&
      window.ffishlib.variants().split(" ").includes("ataxx"),
    { timeout: 30000 },
  );
  const found = await selectVariantBySearchingTypes(page, "ataxx");
  expect(found).toBeTruthy();
  await page.selectOption("#dropdown-variant", "ataxx");

  await page.fill("#fen", "7/7/7/7/7/7/6p w - - 0 1");
  await page.fill("#move", "");
  await page.locator("#setpos").click();

  await page.evaluate(() => {
    document.getElementById("passmove").onclick();
  });

  await expect(page.locator("#move")).toHaveValue("0000");
});

test("selecting argess resets to its black-to-move start position", async ({
  page,
}) => {
  await page.goto("/public/advanced.html");
  await uploadVariantsIni(page);
  await page.waitForFunction(
    () =>
      !!window.ffishlib &&
      typeof window.ffishlib.variants == "function" &&
      window.ffishlib.variants().split(" ").includes("argess"),
    { timeout: 30000 },
  );

  const found = await selectVariantBySearchingTypes(page, "argess");
  expect(found).toBeTruthy();
  await page.selectOption("#dropdown-variant", "argess");

  await expect(page.locator("#label-stm")).toHaveText("black");
  await expect(page.locator("#currentboardfen")).toContainText(
    "rppppnbk/6qb/7n/7p/PPPP3p/RNPP3p/BQNP3p/KBRP3r b - - 0 1",
  );
});

test("selecting checkers resets to its custom start position", async ({
  page,
}) => {
  await page.goto("/public/advanced.html");
  await uploadVariantsIni(page);
  await page.waitForFunction(
    () =>
      !!window.ffishlib &&
      typeof window.ffishlib.variants == "function" &&
      window.ffishlib.variants().split(" ").includes("checkers"),
    { timeout: 30000 },
  );

  const found = await selectVariantBySearchingTypes(page, "checkers");
  expect(found).toBeTruthy();
  await page.selectOption("#dropdown-variant", "checkers");

  await expect(page.locator("#label-stm")).toHaveText("white");
  await expect(page.locator("#currentboardfen")).toContainText(
    "1m1m1m1m/m1m1m1m1/1m1m1m1m/8/8/M1M1M1M1/1M1M1M1M/M1M1M1M1 w - - 0 1",
  );
  await expect(page.locator("#gamestatus")).toHaveText("PLAYING_WHITE");
});

test("selecting antiminishogi starts a live game instead of immediate loss", async ({
  page,
}) => {
  await page.goto("/public/advanced.html");
  await uploadVariantsIni(page);
  await page.waitForFunction(
    () =>
      !!window.ffishlib &&
      typeof window.ffishlib.variants == "function" &&
      window.ffishlib.variants().split(" ").includes("antiminishogi"),
    { timeout: 30000 },
  );

  const found = await selectVariantBySearchingTypes(page, "antiminishogi");
  expect(found).toBeTruthy();
  await page.selectOption("#dropdown-variant", "antiminishogi");

  await expect(page.locator("#label-stm")).toHaveText("white");
  await expect(page.locator("#gamestatus")).toHaveText("PLAYING_WHITE");
  await expect(page.locator("#gameresult")).toHaveValue("");
});

test("selecting battleotk starts a live game instead of immediate terminal state", async ({
  page,
}) => {
  await page.goto("/public/advanced.html");
  await uploadVariantsIni(page);
  await page.waitForFunction(
    () =>
      !!window.ffishlib &&
      typeof window.ffishlib.variants == "function" &&
      window.ffishlib.variants().split(" ").includes("battleotk"),
    { timeout: 30000 },
  );

  const found = await selectVariantBySearchingTypes(page, "battleotk");
  expect(found).toBeTruthy();
  await page.selectOption("#dropdown-variant", "battleotk");

  await expect(page.locator("#label-stm")).toHaveText("white");
  await expect(page.locator("#gamestatus")).toHaveText("PLAYING_WHITE");
  await expect(page.locator("#gameresult")).toHaveValue("");
});

test("annexation pass button handles 0000 in a no-move position", async ({
  page,
}) => {
  await page.goto("/public/advanced.html");
  await uploadVariantsIni(page);
  await page.waitForFunction(
    () =>
      !!window.ffishlib &&
      typeof window.ffishlib.variants == "function" &&
      window.ffishlib.variants().split(" ").includes("annexation"),
    { timeout: 30000 },
  );

  const found = await selectVariantBySearchingTypes(page, "annexation");
  expect(found).toBeTruthy();
  await page.selectOption("#dropdown-variant", "annexation");

  const noMoveSequence =
    "P@d4 P@e4 P@d5 P@c4 P@d6 P@f7 P@f4 P@d7 P@g5 P@f3 P@c7 P@h4 P@e7 P@e8 P@g7 P@c6 P@e9 P@f8 P@b5 P@b7 P@g8 P@a4 P@c5 P@b6 P@f2 P@g2 P@d8 P@f1 P@h6 P@g6 P@a6 P@f10 P@d3 P@i6 P@h5 P@g9 P@j7 P@i5 P@f9 P@b4 P@j5 P@g3 P@a7 P@i7 P@d9 P@d2 P@e3 P@i4 P@e2 P@a5 P@g1 P@g10 P@h7 P@d10 P@j4 P@e1 P@g4 P@j6 P@e10";

  await page.fill("#fen", "");
  await page.fill("#move", noMoveSequence);
  await page.locator("#setpos").click();

  await page.evaluate(() => {
    document.getElementById("passmove").onclick();
  });

  await expect(page.locator("#move")).toHaveValue(`${noMoveSequence} 0000`);
});

test("external engine can play 1d-chess after inline VariantPath apply", async ({
  page,
}) => {
  test.setTimeout(60000);

  await page.goto("/public/advanced.html");
  await waitForVariantOption(page, "chess");

  await connectExternalEngineBackend(page);
  await loadBlackExternalEngine(page);

  await uploadVariantsIni(page);
  await page.waitForFunction(
    () =>
      !!window.ffishlib &&
      typeof window.ffishlib.variants == "function" &&
      window.ffishlib.variants().split(" ").includes("1d-chess"),
    { timeout: 30000 },
  );

  await page.fill("#variantpath-inline", FSF_X_VARIANTS);
  await page.getByRole("button", { name: "Apply VariantPath" }).click();
  await expect(page.locator("#variantpath-status")).toContainText(
    "Applied VariantPath to 1 loaded external engine(s)",
  );

  const found = await selectVariantBySearchingTypes(page, "1d-chess");
  expect(found).toBeTruthy();
  await page.selectOption("#dropdown-variant", "1d-chess");

  const variantSupported = await page.evaluate(() => {
    const fge = window.fairyground.BinaryEngineFeature;
    return fge.second_engine.SetVariant("1d-chess", false);
  });
  expect(variantSupported).toBeTruthy();

  await page.fill("#blackmovetime", "100");
  await page.check("#playblack");

  await page.evaluate(() => {
    document.getElementById("searchmove").click();
  });
  await page.waitForFunction(() => {
    const select = document.querySelector("#availablemovelist");
    return !!select && select.options.length > 1;
  });
  await page.evaluate(() => {
    const select = document.querySelector("#availablemovelist");
    select.selectedIndex = 1;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.evaluate(() => {
    document.getElementById("makemove").click();
  });

  await page.waitForFunction(
    () => {
      const moveBox = document.querySelector("#move");
      if (!moveBox || typeof moveBox.value != "string") {
        return false;
      }
      return moveBox.value.trim().split(/\s+/).filter(Boolean).length >= 2;
    },
    { timeout: 15000 },
  );
});
