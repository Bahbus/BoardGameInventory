import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { catalogFixture } from "../fixtures/catalog";

test.beforeEach(async ({ page }) => {
  await page.route("**/catalog.json", (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify(catalogFixture) })
  );
  await page.goto("/");
});

test("filters the library and preserves shareable settings", async ({ page }) => {
  await expect(page.getByRole("heading", { name: "3 games ready" })).toBeVisible();
  await page.getByLabel("Group size").fill("6");
  await expect(page.getByRole("heading", { name: "1 game ready" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Rocket Racers" })).toBeVisible();
  await expect(page).toHaveURL(/players=6/);
});

test("reveals a weighted roulette result and supports reset", async ({ page }) => {
  await page.getByRole("button", { name: "Roulette" }).click();
  await page.getByRole("button", { name: "Spin the roulette" }).click();
  const skip = page.getByRole("button", { name: "Skip animation" });
  if (await skip.isVisible()) await skip.click();
  await expect(page.getByText("Tonight’s pick")).toBeVisible();
  await expect(page.getByRole("button", { name: "Reset draws" })).toBeVisible();
});

test("prefills an authenticated GitHub maintenance request", async ({ page }) => {
  await page.getByRole("button", { name: "Maintain" }).click();
  await page.getByLabel("BGG ID", { exact: true }).fill("68448");
  await page.getByLabel("Game name").fill("7 Wonders");
  await page.getByLabel("Stable slug").fill("7-wonders");
  await expect(page.getByRole("button", { name: /Continue securely on GitHub/ })).toBeEnabled();
});

test("has no automatically detectable accessibility violations", async ({ page }) => {
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
