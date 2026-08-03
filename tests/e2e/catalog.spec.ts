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

test("gives each primary view its own heading without repeating the library hero", async ({
  page
}) => {
  await expect(page.locator(".hero")).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 1, name: "Find the game that fits the table." })
  ).toBeVisible();

  await page.getByRole("button", { name: "Roulette", exact: true }).click();
  await expect(page.locator(".hero")).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1, name: "Game Night Roulette" })).toBeVisible();

  await page.getByRole("button", { name: "Wish list", exact: true }).click();
  await expect(page.locator(".hero")).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1, name: "Wish list & requests" })).toBeVisible();

  await page.getByRole("button", { name: "Manage", exact: true }).click();
  await expect(page.locator(".hero")).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1, name: "Manage the library" })).toBeVisible();
});

test("keeps intermediate navigation and filters legible", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Intermediate breakpoint contract");

  await page.setViewportSize({ width: 768, height: 1024 });
  const navigation = page.getByRole("navigation", { name: "Primary" });
  const navigationRows = await navigation
    .getByRole("button")
    .evaluateAll((buttons) =>
      Array.from(new Set(buttons.map((button) => Math.round(button.getBoundingClientRect().top))))
    );
  expect(navigationRows).toHaveLength(1);
  const navigationBox = await navigation.boundingBox();
  const brandBox = await page.locator(".brand").boundingBox();
  expect(navigationBox!.y).toBeGreaterThan(brandBox!.y);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(768);

  await page.setViewportSize({ width: 430, height: 900 });
  const compactNavigationRows = await navigation
    .getByRole("button")
    .evaluateAll((buttons) =>
      Array.from(new Set(buttons.map((button) => Math.round(button.getBoundingClientRect().top))))
    );
  expect(compactNavigationRows).toHaveLength(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(430);

  await page.setViewportSize({ width: 1024, height: 900 });
  const filterColumnCount = await page
    .locator(".filter-grid")
    .first()
    .evaluate((grid) => globalThis.getComputedStyle(grid).gridTemplateColumns.split(" ").length);
  expect(filterColumnCount).toBe(3);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(1024);
});

test("filters the library and preserves shareable settings", async ({ page }) => {
  await expect(page.getByRole("heading", { name: "3 games ready" })).toBeVisible();
  await page.getByLabel("Group size").fill("6");
  await expect(page.getByRole("heading", { name: "1 game ready" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Rocket Racers" })).toBeVisible();
  await expect(page).toHaveURL(/players=6/);
});

test("inspects a game without losing the catalog position", async ({ page }, testInfo) => {
  const trigger = page
    .getByRole("article")
    .filter({ has: page.getByRole("heading", { name: "Forest Council", exact: true }) })
    .getByRole("button", { name: "Details" });
  await trigger.click();

  const inspector = page.getByRole("dialog", { name: "Forest Council" });
  await expect(inspector).toBeVisible();
  await expect(inspector.getByRole("button", { name: /Close/ })).toBeFocused();
  await expect(inspector.getByText("2–5 players")).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  if (testInfo.project.name === "wide") {
    const inspectorBox = await inspector.boundingBox();
    const triggerBox = await trigger.boundingBox();
    expect(inspectorBox!.x).toBeGreaterThan(triggerBox!.x);
    await expect(page.getByRole("button", { name: "Close game details" })).toBeHidden();
  } else {
    await expect(page.getByRole("button", { name: "Close game details" })).toBeVisible();
  }

  await page.keyboard.press("Escape");
  await expect(inspector).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("uses wide screens for persistent filters and a denser catalog", async ({
  page
}, testInfo) => {
  test.skip(testInfo.project.name !== "wide", "Wide-layout contract");
  expect(page.viewportSize()).toEqual({ width: 2560, height: 1440 });
  await expect(page.locator(".discovery-layout")).toHaveCSS("display", "grid");

  const filter = page.getByRole("complementary", {
    name: "Group requirements and preferences"
  });
  const library = page.getByRole("region", { name: /games ready/ });
  const filterBox = await filter.boundingBox();
  const libraryBox = await library.boundingBox();

  expect(filterBox).not.toBeNull();
  expect(libraryBox).not.toBeNull();
  expect(filterBox!.x).toBeLessThan(libraryBox!.x);
  await expect(filter).toHaveCSS("position", "sticky");

  const catalogColumns = await page
    .locator(".game-grid")
    .evaluate((element) =>
      globalThis.getComputedStyle(element).gridTemplateColumns.split(" ").filter(Boolean)
    );
  expect(catalogColumns).toHaveLength(4);

  await page.getByRole("button", { name: "Roulette" }).click();
  const rouletteBox = await page.getByRole("region", { name: "Game Night Roulette" }).boundingBox();
  const rouletteFilterBox = await filter.boundingBox();
  expect(rouletteFilterBox!.x).toBeLessThan(rouletteBox!.x);
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
  const setupNavigator = page.getByRole("complementary", {
    name: "Setup progress and game navigation"
  });
  if ((page.viewportSize()?.width ?? 0) >= 1280) {
    await expect(setupNavigator).toBeVisible();
    await expect(
      setupNavigator.getByRole("navigation", { name: "Games to set up" }).getByRole("button")
    ).toHaveText(["First Game", "Local Game"]);
    await expect(page.getByLabel("Jump to a game")).toBeHidden();
    const accessBox = await page.locator(".setup-access-bar").boundingBox();
    const setupBox = await page.locator(".setup-shell").boundingBox();
    expect(accessBox!.width).toBeCloseTo(setupBox!.width, 0);
    const setupNavigatorBox = await setupNavigator.boundingBox();
    const setupMainBox = await page.locator(".setup-workspace-main").boundingBox();
    expect(setupNavigatorBox!.height).toBeLessThan(setupMainBox!.height);
    const overviewTitleBox = await page.locator(".setup-overview-title").boundingBox();
    const overviewCopyBox = await page.locator(".setup-overview-copy").boundingBox();
    expect(overviewCopyBox!.x).toBeGreaterThan(overviewTitleBox!.x);
    expect(overviewCopyBox!.y).toBeLessThan(overviewTitleBox!.y + overviewTitleBox!.height);
  } else {
    await expect(setupNavigator).toBeHidden();
    await expect(page.getByLabel("Jump to a game")).toBeVisible();
  }
  await expect(page.locator(".setup-overview-copy span")).toHaveText([
    "Answer what you know, one game at a time.",
    "Progress saves automatically on this device."
  ]);
  expect(
    await page
      .locator(".setup-privacy")
      .evaluate((element) => element.parentElement?.classList.contains("setup-shell"))
  ).toBe(true);
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
  await expect(
    page.locator(".setup-progress:visible").getByText("1 of 2", { exact: true })
  ).toBeVisible();
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
  await expect(
    page.locator(".setup-progress:visible").getByText("2 of 2", { exact: true })
  ).toBeVisible();
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
  await expect(
    page.locator(".setup-progress:visible").getByText("2 of 2", { exact: true })
  ).toBeVisible();
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

test("fits a long setup game list to the questionnaire height", async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) < 1280, "Wide-screen navigator only");
  const setupGames = Array.from({ length: 56 }, (_, index) => ({
    ...setupGame,
    slug: `game-${String(index + 1).padStart(2, "0")}`,
    title: `Game ${String(index + 1).padStart(2, "0")}`
  }));
  await page.route("**/test-setup-service/api/setup/questionnaire", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ schemaVersion: 2, sourceSha: setupSourceSha, games: setupGames })
    })
  );
  await allowSetup(page);
  await page.getByRole("button", { name: "Setup", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Game 01" })).toBeVisible();

  const gameList = page.getByRole("navigation", { name: "Games to set up" });
  await expect
    .poll(() => gameList.evaluate((element) => element.scrollHeight > element.clientHeight))
    .toBe(true);
  const collapsedListSize = await gameList.evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight
  }));
  expect(collapsedListSize.scrollHeight).toBeGreaterThan(collapsedListSize.clientHeight);

  const alignedBoxes = async () => {
    const navigatorBox = await page.locator(".setup-navigator").boundingBox();
    const questionnaireBox = await page.locator(".setup-workspace-main").boundingBox();
    expect(navigatorBox).not.toBeNull();
    expect(questionnaireBox).not.toBeNull();
    expect(navigatorBox!.y + navigatorBox!.height).toBeCloseTo(
      questionnaireBox!.y + questionnaireBox!.height,
      0
    );
    return { navigatorBox: navigatorBox!, questionnaireBox: questionnaireBox! };
  };

  const collapsedBoxes = await alignedBoxes();
  await page
    .getByRole("group", { name: "Mood or vibe" })
    .getByRole("button", { name: "Show all 9 mood or vibe options" })
    .click();
  await page
    .getByRole("group", { name: "Content considerations" })
    .getByRole("button", { name: "Show all 8 content considerations options" })
    .click();
  await page
    .getByRole("group", { name: "Accessibility considerations" })
    .getByRole("button", { name: "Show all 7 accessibility considerations options" })
    .click();
  const expandedBoxes = await alignedBoxes();
  expect(expandedBoxes.questionnaireBox.height).toBeGreaterThan(
    collapsedBoxes.questionnaireBox.height
  );
  expect(expandedBoxes.navigatorBox.height).toBeGreaterThan(collapsedBoxes.navigatorBox.height);
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
