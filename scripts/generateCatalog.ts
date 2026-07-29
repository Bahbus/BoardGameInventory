import { mkdir, writeFile } from "node:fs/promises";
import type { BggMetadata, CatalogGame, CatalogMetadata, CatalogPayload } from "../src/types";
import { fetchBggMetadata } from "./bgg";
import { readInventory } from "./inventoryIo";

const inventory = await readInventory();
const ids = inventory.games
  .flatMap((game) => [game.bggId, ...game.expansions.map((expansion) => expansion.bggId)])
  .filter((id): id is number => id !== undefined);
const token = process.env.BGG_API_TOKEN;
if (process.env.REQUIRE_BGG_ENRICHMENT === "1" && ids.length && !token) {
  throw new Error("BGG_API_TOKEN is required to deploy a non-empty enriched catalog.");
}
const enriched = Boolean(token && ids.length);
const metadata = enriched ? await fetchBggMetadata(ids, token!) : new Map<number, BggMetadata>();

const fallbackMetadata = (
  bggId: number | undefined,
  name: string,
  sourceUrl?: string
): CatalogMetadata => ({
  bggId,
  name,
  categories: [],
  mechanics: [],
  modes: [],
  playerRecommendations: [],
  url: bggId ? `https://boardgamegeek.com/boardgame/${bggId}` : sourceUrl
});

const games: CatalogGame[] = inventory.games.map((game) => ({
  ...game,
  metadata:
    (game.bggId === undefined ? undefined : metadata.get(game.bggId)) ??
    fallbackMetadata(game.bggId, game.name, game.sourceUrl),
  expansions: game.expansions.map((expansion) => ({
    ...expansion,
    metadata:
      (expansion.bggId === undefined ? undefined : metadata.get(expansion.bggId)) ??
      fallbackMetadata(expansion.bggId, expansion.name, expansion.sourceUrl)
  }))
}));

const payload: CatalogPayload = {
  schemaVersion: 1,
  refreshedAt: new Date().toISOString(),
  enriched,
  games
};

const output = new URL("../public/catalog.json", import.meta.url);
await mkdir(new URL("../public/", import.meta.url), { recursive: true });
await writeFile(output, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
console.log(`Generated catalog with ${games.length} base game${games.length === 1 ? "" : "s"}.`);
