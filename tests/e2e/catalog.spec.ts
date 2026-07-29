import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { catalogFixture } from "../fixtures/catalog";

const setupSession = {
  grant: "test-only-opaque-grant",
  login: "Bahbus",
  expiresAt: "2099-01-01T00:00:00.000Z"
};

const setupGame = {
  slug: "accessible-game",
  title: "Accessible Game",
  availability: "available",
  learned: "",
  shelf: "",
  houseRating: "",
  setupMinutes: "",
  teachDifficulty: "",
  tableSpace: "",
  interaction: "",
  luck: "",
  downtime: "",
  modes: "",
  moods: "",
  accessibilityFlags: "",
  contentFlags: "",
  recommendationNotes: "",
  localValuesRequired: "no",
  localMinPlayers: "",
  localMaxPlayers: "",
  localMinMinutes: "",
  localMaxMinutes: "",
  localMinAge: ""
};

const allowSetup = async (page: import("@playwright/test").Page) => {
  await page.route("**/test-setup-service/api/setup/session", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ verified: true, ...setupSession })
    })
  );
  await page.evaluate((session) => {
    globalThis.sessionStorage.setItem(
      "board-game-inventory:setup-access:v1",
      JSON.stringify(session)
    );
  }, setupSession);
};

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
  await page.getByRole("textbox", { name: "BGG ID (optional)", exact: true }).fill("68448");
  await page.getByLabel("Game name").fill("7 Wonders");
  await page.getByLabel("Stable slug").fill("7-wonders");
  await expect(page.getByRole("button", { name: /Continue securely on GitHub/ })).toBeEnabled();
});

test("shows a local-only game with its product source and slug-based edit link", async ({
  page
}) => {
  const localGame = {
    ...catalogFixture.games[1],
    slug: "local-party-game",
    bggId: undefined,
    sourceUrl: "https://publisher.example/local-party-game",
    name: "Local Party Game",
    overrides: {
      minPlayers: 2,
      maxPlayers: 12,
      minMinutes: 15,
      maxMinutes: 30,
      minAge: 18
    },
    metadata: {
      ...catalogFixture.games[1].metadata,
      bggId: undefined,
      name: "Local Party Game",
      url: "https://publisher.example/local-party-game"
    }
  };
  await page.unroute("**/catalog.json");
  await page.route("**/catalog.json", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ ...catalogFixture, games: [localGame] })
    })
  );
  await page.reload();

  await expect(page.getByRole("heading", { name: "Local Party Game" })).toBeVisible();
  await expect(page.getByRole("link", { name: /View product source/ })).toHaveAttribute(
    "href",
    "https://publisher.example/local-party-game"
  );
  await expect(page.getByRole("link", { name: "Suggest edit" })).toHaveAttribute(
    "href",
    /slug=local-party-game/
  );
  await expect(page.getByRole("link", { name: "Suggest edit" })).not.toHaveAttribute(
    "href",
    /bgg-id=/
  );
});

test("has no automatically detectable accessibility violations", async ({ page }) => {
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test("supports the GitHub Pages repository path", async ({ page }) => {
  await page.goto("/BoardGameInventory/");
  await expect(page.getByRole("heading", { name: "3 games ready" })).toBeVisible();
  await expect(page).toHaveURL(/\/BoardGameInventory\/\?v=1/);
});

test("offers useful recovery when no game meets the requirements", async ({ page }) => {
  await page.getByLabel("Group size").fill("99");
  await expect(
    page.getByRole("heading", { name: "No game meets every requirement" })
  ).toBeVisible();
  await page.getByRole("button", { name: "Clear requirements" }).click();
  await expect(page.getByRole("heading", { name: "3 games ready" })).toBeVisible();
});

test("guides an empty collection toward its first addition", async ({ page }) => {
  await page.unroute("**/catalog.json");
  await page.route("**/catalog.json", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ ...catalogFixture, games: [] })
    })
  );
  await page.reload();

  await expect(
    page.getByRole("heading", { name: "The shelves are ready for their first game" })
  ).toBeVisible();
  await page.getByRole("button", { name: "Add the first game" }).click();
  await expect(page.getByRole("heading", { name: "Prepare an inventory request" })).toBeVisible();
});

test("falls back cleanly when an external cover cannot load", async ({ page }) => {
  const brokenCover = {
    ...catalogFixture.games[0],
    metadata: {
      ...catalogFixture.games[0].metadata,
      thumbnail: "https://images.invalid.example/missing-cover.jpg"
    }
  };
  await page.unroute("**/catalog.json");
  await page.route("**/catalog.json", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ ...catalogFixture, games: [brokenCover] })
    })
  );
  await page.route("https://images.invalid.example/**", (route) => route.abort());
  await page.reload();

  await expect(page.locator(".cover-fallback").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Forest Council", exact: true })).toBeVisible();
});

test("supports keyboard navigation between primary views", async ({ page }) => {
  const maintain = page.getByRole("button", { name: "Maintain" });
  await maintain.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Prepare an inventory request" })).toBeVisible();
  await expect(maintain).toBeFocused();

  const roulette = page.getByRole("button", { name: "Roulette", exact: true });
  await roulette.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Game Night Roulette" })).toBeVisible();
  await expect(roulette).toBeFocused();
});

test("reveals roulette results immediately when reduced motion is requested", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("button", { name: "Roulette" }).click();
  await page.getByRole("button", { name: "Spin the roulette" }).click();

  await expect(page.getByText("Tonight’s pick")).toBeVisible();
  await expect(page.getByRole("button", { name: "Skip animation" })).toHaveCount(0);
  await expect(page.locator(".winner-panel")).toHaveAttribute("aria-busy", "false");
});

test("guides house answers one game at a time and keeps progress locally", async ({ page }) => {
  const setupGames = [
    {
      slug: "first-game",
      title: "First Game",
      availability: "available",
      learned: "",
      shelf: "",
      houseRating: "",
      setupMinutes: "",
      teachDifficulty: "",
      tableSpace: "",
      interaction: "",
      luck: "",
      downtime: "",
      modes: "",
      moods: "",
      accessibilityFlags: "",
      contentFlags: "",
      recommendationNotes: "",
      localValuesRequired: "no",
      localMinPlayers: "",
      localMaxPlayers: "",
      localMinMinutes: "",
      localMaxMinutes: "",
      localMinAge: ""
    },
    {
      slug: "local-game",
      title: "Local Game",
      availability: "available",
      learned: "",
      shelf: "",
      houseRating: "",
      setupMinutes: "",
      teachDifficulty: "",
      tableSpace: "",
      interaction: "",
      luck: "",
      downtime: "",
      modes: "",
      moods: "",
      accessibilityFlags: "",
      contentFlags: "alcohol",
      recommendationNotes: "",
      localValuesRequired: "yes",
      localMinPlayers: "",
      localMaxPlayers: "",
      localMinMinutes: "",
      localMaxMinutes: "",
      localMinAge: ""
    }
  ];
  await page.route("**/test-setup-service/api/setup/questionnaire", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ schemaVersion: 1, games: setupGames })
    })
  );
  await allowSetup(page);

  await page.getByRole("button", { name: "Setup", exact: true }).click();
  await expect(page.getByText("Verified collaborator:")).toBeVisible();
  await expect(page.getByRole("heading", { name: "First Game" })).toBeVisible();
  await page.getByLabel("Have you learned it?").selectOption("yes");
  await page.getByLabel("Overall house rating").selectOption("4");
  await page.getByLabel("Cooperative").check();
  await page.getByRole("button", { name: "Save & next" }).click();

  await expect(page.getByRole("heading", { name: "Local Game" })).toBeVisible();
  await expect(page.getByText("1 of 2", { exact: true })).toBeVisible();
  await page.getByLabel("Have you learned it?").selectOption("no");
  await page.getByLabel("Minimum players").fill("2");
  await page.getByLabel("Maximum players").fill("8");
  await page.getByLabel("Minimum minutes").fill("15");
  await page.getByLabel("Maximum minutes").fill("30");
  await page.getByLabel("Minimum age").fill("18");
  await page.getByRole("button", { name: "Save game" }).click();
  await expect(page.getByText("2 of 2", { exact: true })).toBeVisible();
  await expect(page.getByText("Every game has a completed answer.")).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download answers" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("inventory-house-answers.csv");

  await page.reload();
  await page.getByRole("button", { name: "Setup", exact: true }).click();
  await expect(page.getByText("2 of 2", { exact: true })).toBeVisible();
});

test("keeps the guided setup screen free of detectable accessibility violations", async ({
  page
}) => {
  await page.route("**/test-setup-service/api/setup/questionnaire", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ schemaVersion: 1, games: [setupGame] })
    })
  );
  await allowSetup(page);
  await page.getByRole("button", { name: "Setup", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Tell us about the games" })).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test("keeps setup hidden until collaborator access is verified", async ({ page }) => {
  let questionnaireRequests = 0;
  await page.route("**/test-setup-service/api/setup/questionnaire", (route) => {
    questionnaireRequests += 1;
    return route.abort();
  });

  await page.getByRole("button", { name: "Setup", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Collaborator verification required" })
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Tell us about the games" })).toHaveCount(0);
  expect(questionnaireRequests).toBe(0);
});

test("explains failed verification without revealing setup", async ({ page }) => {
  await page.route("**/test-setup-service/api/setup/session", (route) =>
    route.fulfill({ status: 403 })
  );
  await page.evaluate((session) => {
    globalThis.sessionStorage.setItem(
      "board-game-inventory:setup-access:v1",
      JSON.stringify(session)
    );
  }, setupSession);

  await page.getByRole("button", { name: "Setup", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "We couldn’t verify collaborator access" })
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Tell us about the games" })).toHaveCount(0);
});
