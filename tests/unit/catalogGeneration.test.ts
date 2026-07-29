import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { buildCatalogPayload, generateCatalog } from "../../scripts/catalogGeneration";
import type { Inventory } from "../../src/types";

const inventory: Inventory = {
  version: 1,
  games: [
    {
      slug: "linked-game",
      bggId: 101,
      name: "Linked Game",
      quantity: 1,
      availability: "available",
      learned: false,
      house: {
        modes: [],
        moods: [],
        accessibilityFlags: [],
        contentFlags: []
      },
      expansions: []
    }
  ]
};

describe("catalog generation", () => {
  it("builds a usable fallback catalog without a token", async () => {
    const payload = await buildCatalogPayload({
      inventory,
      now: () => new Date("2026-01-02T03:04:05.000Z")
    });

    expect(payload).toMatchObject({
      refreshedAt: "2026-01-02T03:04:05.000Z",
      enriched: false,
      games: [
        {
          slug: "linked-game",
          metadata: {
            bggId: 101,
            name: "Linked Game",
            url: "https://boardgamegeek.com/boardgame/101"
          }
        }
      ]
    });
  });

  it("preserves the previous catalog when enrichment fails", async () => {
    const directory = await mkdtemp(join(tmpdir(), "board-game-catalog-"));
    const output = pathToFileURL(join(directory, "catalog.json"));
    await writeFile(output, '{"known":"good"}\n', "utf8");
    const fetcher = async () => new Response("", { status: 401 });

    await expect(
      generateCatalog({
        inventory,
        output,
        token: "token",
        fetcher: fetcher as typeof fetch
      })
    ).rejects.toThrow(/returned 401/);
    await expect(readFile(output, "utf8")).resolves.toBe('{"known":"good"}\n');
  });
});
