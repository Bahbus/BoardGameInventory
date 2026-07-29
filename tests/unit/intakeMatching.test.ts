import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  buildMatchingManifest,
  directBggId,
  matchingManifestToCsv,
  parseIntakeCsv,
  parseMatchingManifest,
  slugify
} from "../../scripts/intakeMatching";

describe("inventory matching manifest", () => {
  it("creates stable slugs and preserves all resolved parent relationships", async () => {
    const intake = parseIntakeCsv(await readFile("data/inventory.intake.csv", "utf8"));
    const manifest = buildMatchingManifest(intake);
    const slugs = new Set(manifest.map((row) => row.slug));
    const baseSlugs = new Set(manifest.filter((row) => row.kind === "game").map((row) => row.slug));

    expect(manifest).toHaveLength(82);
    expect(slugs.size).toBe(82);
    expect(
      manifest
        .filter((row) => row.kind === "expansion")
        .every((row) => baseSlugs.has(row.parentSlug))
    ).toBe(true);
    expect(slugify("The Game of THINGS…")).toBe("the-game-of-things");
  });

  it("extracts only direct BGG identity links", () => {
    expect(directBggId("https://boardgamegeek.com/boardgame/9209/ticket-to-ride")).toBe(9209);
    expect(
      directBggId(
        "https://boardgamegeek.com/boardgameexpansion/392144/command-of-nature-sand-and-wind"
      )
    ).toBe(392144);
    expect(
      directBggId("https://boardgamegeek.com/boardgame/290484/unsettled/expansions")
    ).toBeUndefined();
    expect(directBggId("https://publisher.example/game")).toBeUndefined();
  });

  it("classifies direct, local-only, pending, and shared-ID rows", async () => {
    const manifest = buildMatchingManifest(
      parseIntakeCsv(await readFile("data/inventory.intake.csv", "utf8"))
    );
    expect(manifest.find((row) => row.slug === "ticket-to-ride")?.matchStatus).toBe(
      "matched-from-source"
    );
    expect(manifest.find((row) => row.slug === "buzzed-tower")?.matchStatus).toBe("local-only");
    expect(manifest.find((row) => row.slug === "wingspan")?.matchStatus).toBe("pending-bgg-search");
    expect(
      manifest
        .filter((row) => row.proposedTitle.startsWith("Dice Throne: Season One"))
        .every((row) => row.matchStatus === "review-shared-bgg-id")
    ).toBe(true);
  });

  it("round-trips the deterministic manifest CSV", async () => {
    const manifest = buildMatchingManifest(
      parseIntakeCsv(await readFile("data/inventory.intake.csv", "utf8"))
    );
    expect(parseMatchingManifest(matchingManifestToCsv(manifest))).toEqual(manifest);
  });
});
