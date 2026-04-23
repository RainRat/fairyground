const { test, expect } = require("@playwright/test");
const path = require("path");

const FSF_X_BINARY = "/home/chris/Fairy-Stockfish-X/src/stockfish";
const FSF_X_SRC_DIR = "/home/chris/Fairy-Stockfish-X/src";
const FSF_X_VARIANTS = "/home/chris/Fairy-Stockfish-X/src/variants.ini";

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

  const variantsPath = path.resolve(
    "/home/chris/Fairy-Stockfish-X/src/variants.ini",
  );
  await page.setInputFiles("#variants-ini", variantsPath);

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
  await page.setInputFiles("#variants-ini", path.resolve(FSF_X_VARIANTS));
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
  await page.setInputFiles("#variants-ini", path.resolve(FSF_X_VARIANTS));
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

test("external engine can play 1d-chess after inline VariantPath apply", async ({
  page,
}) => {
  test.setTimeout(60000);

  await page.goto("/public/advanced.html");
  await waitForVariantOption(page, "chess");

  await connectExternalEngineBackend(page);
  await loadBlackExternalEngine(page);

  await page.setInputFiles("#variants-ini", path.resolve(FSF_X_VARIANTS));
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
