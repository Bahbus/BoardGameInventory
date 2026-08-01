import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { buildHouseIntake, houseIntakeToCsv } from "../../scripts/houseIntake";
import { finalizeInventory } from "../../scripts/inventoryFinalization";
import { matchingManifestToCsv, type MatchingRow } from "../../scripts/intakeMatching";
import { serializeInventory, writeInventory } from "../../scripts/inventoryIo";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true }))
  );
});

const matchingRow = (overrides: Partial<MatchingRow> = {}): MatchingRow => ({
  slug: "alpha",
  kind: "game",
  parentSlug: "",
  proposedTitle: "Alpha",
  editionOrOwnedDetail: "First edition",
  quantity: 2,
  standalone: false,
  sourceUrl: "https://boardgamegeek.com/boardgame/100/alpha",
  knownBggId: 100,
  matchStatus: "matched-from-source",
  intakeNotes: "Owned copy confirmed.",
  matchingNotes: "",
  ...overrides
});

const manifest = (): MatchingRow[] => [
  matchingRow(),
  matchingRow({
    slug: "alpha-module",
    kind: "expansion",
    parentSlug: "alpha",
    proposedTitle: "Alpha Module",
    editionOrOwnedDetail: "",
    quantity: 1,
    standalone: true,
    sourceUrl: "https://boardgamegeek.com/boardgame/101/alpha-module",
    knownBggId: 101,
    intakeNotes: "",
    matchingNotes: "Compatible with Alpha."
  }),
  matchingRow({
    slug: "alpha-local-module",
    kind: "expansion",
    parentSlug: "alpha",
    proposedTitle: "Alpha Local Module",
    editionOrOwnedDetail: "Promo pack",
    quantity: 1,
    standalone: false,
    sourceUrl: "https://publisher.example/alpha",
    knownBggId: undefined,
    matchStatus: "local-only",
    intakeNotes: "Bundled module.",
    matchingNotes: "Inherits Alpha metadata."
  }),
  matchingRow({
    slug: "local-party",
    proposedTitle: "Local Party",
    editionOrOwnedDetail: "",
    quantity: 1,
    sourceUrl: "https://publisher.example/local-party",
    knownBggId: undefined,
    matchStatus: "local-only",
    intakeNotes: "",
    matchingNotes: ""
  })
];

function completedHouseCsv(rows = manifest()) {
  return houseIntakeToCsv(
    buildHouseIntake(rows).map((row) =>
      row.slug === "alpha"
        ? {
            ...row,
            learned: "yes",
            shelf: "Shelf A",
            availability: "loaned",
            houseRating: "5",
            setupTimeRange: "11-20",
            teachDifficulty: "2",
            tableSpace: "standard",
            interaction: "4",
            luck: "2",
            downtime: "1",
            moods: "strategic;social",
            accessibilityFlags: "small-text",
            contentFlags: "spiders",
            recommendationNotes: "Best with four."
          }
        : {
            ...row,
            learned: "no",
            modes: "competitive;solo",
            localMinPlayers: "1",
            localMaxPlayers: "8",
            localMinMinutes: "15",
            localMaxMinutes: "30",
            localMinAge: "18"
          }
    )
  );
}

describe("inventory finalization", () => {
  it("combines matching and Setup data into deterministic canonical inventory", () => {
    const rows = manifest();
    const inventory = finalizeInventory(matchingManifestToCsv(rows), completedHouseCsv(rows));

    expect(inventory.games.map((game) => game.slug)).toEqual(["alpha", "local-party"]);
    expect(inventory.games[0]).toMatchObject({
      slug: "alpha",
      bggId: 100,
      sourceUrl: "https://boardgamegeek.com/boardgame/100/alpha",
      edition: "First edition",
      quantity: 2,
      shelf: "Shelf A",
      availability: "loaned",
      learned: true,
      ownershipNotes: "Owned copy confirmed.",
      house: {
        rating: 5,
        setupTimeRange: "11-20",
        teachDifficulty: 2,
        tableSpace: "standard",
        interaction: 4,
        luck: 2,
        downtime: 1,
        modes: [],
        moods: ["strategic", "social"],
        accessibilityFlags: ["small-text"],
        contentFlags: ["spiders"],
        recommendationNotes: "Best with four."
      }
    });
    expect(inventory.games[0].expansions).toEqual([
      expect.objectContaining({
        slug: "alpha-local-module",
        standalone: false,
        shelf: "Shelf A",
        availability: "loaned",
        learned: true,
        compatibilityNotes: "Inherits Alpha metadata."
      }),
      expect.objectContaining({
        slug: "alpha-module",
        bggId: 101,
        standalone: true,
        compatibilityNotes: "Compatible with Alpha."
      })
    ]);
    expect(inventory.games[1]).toMatchObject({
      slug: "local-party",
      bggId: undefined,
      learned: false,
      house: { modes: ["competitive", "solo"] },
      overrides: {
        minPlayers: 1,
        maxPlayers: 8,
        minMinutes: 15,
        maxMinutes: 30,
        minAge: 18
      }
    });

    expect(serializeInventory(inventory)).toBe(
      serializeInventory(
        finalizeInventory(matchingManifestToCsv([...rows].reverse()), completedHouseCsv(rows))
      )
    );
  });

  it("rejects incomplete or mismatched Setup answers", () => {
    const rows = manifest();
    const incomplete = houseIntakeToCsv(buildHouseIntake(rows));
    expect(() => finalizeInventory(matchingManifestToCsv(rows), incomplete)).toThrow(
      /must state whether the game is learned/
    );

    const missing = houseIntakeToCsv(
      buildHouseIntake(rows)
        .filter((row) => row.slug !== "alpha")
        .map((row) => ({ ...row, learned: "yes" }))
    );
    expect(() => finalizeInventory(matchingManifestToCsv(rows), missing)).toThrow(
      /Setup answers are missing base game alpha/
    );
  });

  it("rejects invalid house enumerations, modes, and ranges", () => {
    const rows = manifest();
    expect(() =>
      finalizeInventory(
        matchingManifestToCsv(rows),
        completedHouseCsv(rows).replace("alpha,Alpha,loaned", "alpha,Alpha,maybe")
      )
    ).toThrow(/invalid availability/);

    expect(() =>
      finalizeInventory(
        matchingManifestToCsv(rows),
        completedHouseCsv(rows).replace("competitive;solo", "competitive;duel")
      )
    ).toThrow(/invalid game mode/);

    expect(() =>
      finalizeInventory(
        matchingManifestToCsv(rows),
        completedHouseCsv(rows).replace(",1,8,15,30,18", ",9,8,15,30,18")
      )
    ).toThrow(/inverted player range/);
  });

  it.each([
    [
      "unresolved status",
      (rows: MatchingRow[]) => {
        rows[0].matchStatus = "pending-bgg-search";
      },
      /not resolved/
    ],
    [
      "duplicate slug",
      (rows: MatchingRow[]) => {
        rows[1].slug = "alpha";
      },
      /repeats slug/
    ],
    [
      "duplicate BGG ID",
      (rows: MatchingRow[]) => {
        rows[1].knownBggId = 100;
      },
      /repeats BGG ID/
    ],
    [
      "mismatched BGG source",
      (rows: MatchingRow[]) => {
        rows[1].sourceUrl = "https://boardgamegeek.com/boardgame/999/wrong";
      },
      /source URL does not identify BGG ID 101/
    ],
    [
      "missing parent",
      (rows: MatchingRow[]) => {
        rows[1].parentSlug = "missing";
      },
      /missing base-game parent/
    ],
    [
      "local standalone expansion",
      (rows: MatchingRow[]) => {
        rows[2].standalone = true;
      },
      /local standalone expansion/
    ]
  ])("rejects a manifest with %s", (_label, mutate, expected) => {
    const rows = manifest();
    mutate(rows);
    expect(() => finalizeInventory(matchingManifestToCsv(rows), completedHouseCsv())).toThrow(
      expected
    );
  });

  it("rejects invalid quantities and unsafe local-value drift with row-specific errors", () => {
    const rows = manifest();
    const invalidQuantity = matchingManifestToCsv(rows).replace(
      "alpha,game,,Alpha,First edition,2,false",
      "alpha,game,,Alpha,First edition,0,false"
    );
    expect(() => finalizeInventory(invalidQuantity, completedHouseCsv(rows))).toThrow(
      /Matching row 2 has an invalid quantity/
    );

    const houseRows = buildHouseIntake(rows).map((row) => ({
      ...row,
      learned: "yes",
      modes: row.localValuesRequired === "yes" ? "competitive" : "",
      localMinPlayers: "1",
      localMaxPlayers: row.localValuesRequired === "yes" ? "8" : "",
      localMinMinutes: row.localValuesRequired === "yes" ? "15" : "",
      localMaxMinutes: row.localValuesRequired === "yes" ? "30" : "",
      localMinAge: row.localValuesRequired === "yes" ? "18" : ""
    }));
    expect(() =>
      finalizeInventory(matchingManifestToCsv(rows), houseIntakeToCsv(houseRows))
    ).toThrow(/local filter values for BGG-linked game alpha/);
  });

  it("validates before atomically replacing an existing inventory file", async () => {
    const directory = await mkdtemp(join(tmpdir(), "inventory-finalization-"));
    temporaryDirectories.push(directory);
    const path = pathToFileURL(join(directory, "inventory.yaml"));
    await writeFile(path, "preserve me\n", "utf8");

    await expect(
      writeInventory({ version: 1, games: [{ slug: "invalid" }] } as never, path)
    ).rejects.toThrow();
    expect(await readFile(path, "utf8")).toBe("preserve me\n");

    const rows = manifest();
    const inventory = finalizeInventory(matchingManifestToCsv(rows), completedHouseCsv(rows));
    await writeInventory(inventory, path);
    expect(await readFile(path, "utf8")).toBe(serializeInventory(inventory));
  });
});
