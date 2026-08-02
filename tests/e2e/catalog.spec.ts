import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { catalogFixture } from "../fixtures/catalog";

const setupSession = {
  grant: "test-only-opaque-grant",
  login: "Bahbus",
  expiresAt: "2099-01-01T00:00:00.000Z"
};
const setupSourceSha = "a".repeat(40);

const setupGame = {
  slug: "accessible-game",
  title: "Accessible Game",
  availability: "available",
  learned: "",
  shelf: "",
  houseRating: "",
  setupTimeRange: "",
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

test("orders related navigation together and hides completed Setup", async ({ page }) => {
  const navigation = page.getByRole("navigation", { name: "Primary" });
  await expect(navigation.getByRole("button")).toHaveText([
    "Library",
    "Roulette",
    "Wish list",
    "Manage",
    "Setup"
  ]);

  await page.unroute("**/catalog.json");
  await page.route("**/catalog.json", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ ...catalogFixture, setupRequired: false })
    })
  );
  await page.reload();
  await expect(page.getByRole("button", { name: "Setup", exact: true })).toHaveCount(0);
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
  await page.getByRole("button", { name: "Manage" }).click();
  await page.getByLabel("Game name").fill("7 Wonders");
  await page
    .getByLabel("BGG link or another product page")
    .fill("https://boardgamegeek.com/boardgame/68448/7-wonders");
  await expect(page.getByLabel("Stable slug")).toHaveValue("7-wonders");
  await expect(page.getByRole("button", { name: /Continue game details on GitHub/ })).toBeEnabled();

  await page.getByRole("radio", { name: "Update" }).check();
  await page.getByLabel("Game or expansion").selectOption("forest-council");
  await expect(page.getByRole("button", { name: /Choose changes on GitHub/ })).toBeEnabled();

  await page.getByRole("radio", { name: "Remove" }).check();
  await page.getByLabel("Game or expansion").selectOption("moonlit-paths");
  await expect(page.getByRole("button", { name: /Review removal on GitHub/ })).toBeEnabled();
});

test("keeps unowned games in a searchable wish list and out of roulette", async ({ page }) => {
  await page.unroute("**/catalog.json");
  await page.route("**/catalog.json", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ...catalogFixture,
        wishlist: [
          {
            slug: "future-game",
            bggId: 202,
            name: "Future Game",
            status: "planned",
            priority: 5,
            notes: "Strong two-player candidate.",
            metadata: {
              bggId: 202,
              name: "Future Game",
              categories: ["Strategy"],
              mechanics: [],
              modes: [],
              playerRecommendations: [],
              url: "https://boardgamegeek.com/boardgame/202"
            }
          }
        ]
      })
    })
  );
  await page.reload();

  await page.getByRole("button", { name: "Wish list" }).click();
  await expect(page.getByRole("heading", { name: "Wish list & requests" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Future Game" })).toBeVisible();
  await expect(page.getByText("Planning to buy")).toBeVisible();
  await page.getByRole("searchbox", { name: "Search wish list" }).fill("missing");
  await expect(
    page.getByRole("heading", { name: "No wish-list game matches that search" })
  ).toBeVisible();

  await page.getByRole("button", { name: "Roulette" }).click();
  await expect(page.getByText("Future Game")).toHaveCount(0);
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
  await expect(page.getByRole("heading", { name: "Manage the library" })).toBeVisible();
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
  const maintain = page.getByRole("button", { name: "Manage" });
  await maintain.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Manage the library" })).toBeVisible();
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
      setupTimeRange: "",
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
      setupTimeRange: "",
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
  ].reverse();
  await page.route("**/test-setup-service/api/setup/questionnaire", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ schemaVersion: 2, sourceSha: setupSourceSha, games: setupGames })
    })
  );
  await page.route("**/setup-suggestions.json", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        schemaVersion: 1,
        sourceSha: setupSourceSha,
        enriched: true,
        suggestions: [
          {
            slug: "first-game",
            bggId: 101,
            moods: ["strategic"],
            accessibilityFlags: ["memory-heavy"],
            contentFlags: ["horror"],
            categories: ["Horror"],
            mechanics: ["Memory", "Worker Placement"]
          }
        ]
      })
    })
  );
  await page.route("**/test-setup-service/api/setup/submit", (route) =>
    route.fulfill({
      contentType: "application/json",
      status: 201,
      body: JSON.stringify({
        pullRequestNumber: 42,
        pullRequestUrl: "https://github.com/Bahbus/BoardGameInventory/pull/42"
      })
    })
  );
  await allowSetup(page);

  await page.getByRole("button", { name: "Setup", exact: true }).click();
  await expect(page.getByText("Verified collaborator:")).toBeVisible();
  await expect(page.getByRole("heading", { name: "First Game" })).toBeVisible();
  await expect(page.getByText("BGG suggestions are preselected.")).toBeVisible();
  await expect(page.locator(".setup-tag-field legend")).toHaveText([
    "Mood or vibe",
    "Content considerations",
    "Accessibility considerations"
  ]);
  const moodGroup = page.getByRole("group", { name: "Mood or vibe" });
  await expect(moodGroup.getByRole("checkbox")).toHaveCount(1);
  await expect(moodGroup.getByLabel("Strategic / thinky")).toBeChecked();
  await expect(
    page
      .getByRole("group", { name: "Accessibility considerations" })
      .getByLabel("Memory-heavy play")
  ).toBeChecked();
  await expect(
    page.getByRole("group", { name: "Content considerations" }).getByLabel("Horror")
  ).toBeChecked();
  await expect(page.getByText("Progress saves automatically in this browser.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Back up progress" })).toHaveCount(0);
  await expect(page.getByText("Restore progress", { exact: true })).toHaveCount(0);
  await page.getByLabel("Have you learned it?").selectOption("yes");
  await page.getByLabel("Overall house rating").selectOption("4");
  await page.getByLabel("Setup time").selectOption("11-20");
  await moodGroup.getByRole("button", { name: "Show all 9 mood or vibe options" }).click();
  await expect(moodGroup.locator(".setup-checkboxes span")).toHaveText([
    "Casual / relaxed",
    "Chaotic",
    "Cozy",
    "Immersive / thematic",
    "Puzzly",
    "Silly",
    "Social",
    "Strategic / thinky",
    "Tense"
  ]);
  await moodGroup.getByLabel("Strategic / thinky").check();
  const otherMood = moodGroup.getByLabel("Other (separate multiple tags with commas)");
  await otherMood.pressSequentially("nostalgic, contemplative");
  await expect(otherMood).toHaveValue("nostalgic, contemplative");
  const accessibilityGroup = page.getByRole("group", { name: "Accessibility considerations" });
  await accessibilityGroup
    .getByRole("button", { name: "Show all 7 accessibility considerations options" })
    .click();
  await accessibilityGroup.getByLabel("Small text").check();
  const contentGroup = page.getByRole("group", { name: "Content considerations" });
  await contentGroup
    .getByRole("button", { name: "Show all 8 content considerations options" })
    .click();
  await contentGroup.getByLabel("Mature themes").check();
  await expect(page.getByRole("group", { name: "Supported styles" })).toHaveCount(0);
  await page.getByRole("button", { name: "Save & next" }).click();

  await expect(page.getByRole("heading", { name: "Local Game" })).toBeVisible();
  await expect(page.getByText("1 of 2", { exact: true })).toBeVisible();
  await expect(page.getByRole("group", { name: "Mood or vibe" }).getByRole("checkbox")).toHaveCount(
    3
  );
  await page.getByLabel("Have you learned it?").selectOption("no");
  await page.getByLabel("Minimum players").fill("2");
  await page.getByLabel("Maximum players").fill("8");
  await page.getByLabel("Minimum minutes").fill("15");
  await page.getByLabel("Maximum minutes").fill("30");
  await page.getByLabel("Minimum age").fill("18");
  await page.getByLabel("Competitive").check();
  await page.getByLabel("Solo").check();
  await page.getByRole("button", { name: "Save game" }).click();
  await expect(page.getByText("2 of 2", { exact: true })).toBeVisible();
  await expect(page.getByText("Every game has a completed answer.")).toBeVisible();
  await page.getByRole("button", { name: "Save to GitHub" }).click();
  await expect(page.getByRole("link", { name: "Open pull request #42 on GitHub" })).toHaveAttribute(
    "href",
    "https://github.com/Bahbus/BoardGameInventory/pull/42"
  );

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download CSV copy" }).click();
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
      body: JSON.stringify({
        schemaVersion: 2,
        sourceSha: setupSourceSha,
        games: [setupGame]
      })
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

test("shows the safe GitHub App recovery message when setup data cannot open", async ({ page }) => {
  await page.route("**/test-setup-service/api/setup/questionnaire", (route) =>
    route.fulfill({
      contentType: "application/json",
      status: 503,
      body: JSON.stringify({
        code: "github_installation_auth",
        message:
          "GitHub could not open the setup data. Please try again after the App installation is checked."
      })
    })
  );
  await allowSetup(page);

  await page.getByRole("button", { name: "Setup", exact: true }).click();
  await expect(page.getByRole("heading", { name: "We couldn’t open game setup" })).toBeVisible();
  await expect(page.getByText(/App installation is checked/)).toBeVisible();
});
