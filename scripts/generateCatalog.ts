import { generateCatalog } from "./catalogGeneration";
import { readInventory } from "./inventoryIo";

const inventory = await readInventory();
const token = process.env.BGG_API_TOKEN;
const output = new URL("../public/catalog.json", import.meta.url);
const payload = await generateCatalog({
  inventory,
  output,
  token,
  requireEnrichment: process.env.REQUIRE_BGG_ENRICHMENT === "1"
});
console.log(
  `Generated catalog with ${payload.games.length} base game${payload.games.length === 1 ? "" : "s"}.`
);
