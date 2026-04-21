const { test, expect } = require("@playwright/test");
const path = require("path");

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
