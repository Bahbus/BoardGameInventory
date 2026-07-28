import { mkdir, writeFile } from "node:fs/promises";
import type { BggMetadata, CatalogGame, CatalogPayload } from "../src/types";
import { fetchBggMetadata } from "./bgg";
import { readInventory } from "./inventoryIo";

const inventory = await readInventory();
const ids = inventory.games.flatMap((game) => [
  game.bggId,
  ...game.expansions.map((expansion) => expansion.bggId)
]);
const token = process.env.BGG_API_TOKEN;
if (process.env.REQUIRE_BGG_ENRICHMENT === "1" && ids.length && !token) {
  throw new Error("BGG_API_TOKEN is required to deploy a non-empty enriched catalog.");
}
const enriched = Boolean(token && ids.length);
const metadata = enriched ? await fetchBggMetadata(ids, token!) : new Map<number, BggMetadata>();

const fallbackMetadata = (bggId: number, name: string): BggMetadata => ({
  bggId,
  name,
  categories: [],
  mechanics: [],
  modes: [],
  playerRecommendations: [],
  url: `https://boardgamegeek.com/boardgame/${bggId}`
});

const games: CatalogGame[] = inventory.games.map((game) => ({
  ...game,
  metadata: metadata.get(game.bggId) ?? fallbackMetadata(game.bggId, game.name),
  expansions: game.expansions.map((expansion) => ({
    ...expansion,
    metadata: metadata.get(expansion.bggId) ?? fallbackMetadata(expansion.bggId, expansion.name)
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
