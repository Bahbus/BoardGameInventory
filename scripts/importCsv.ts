import { readFile } from "node:fs/promises";
import { formatZodError, writeInventory } from "./inventoryIo";
import { inventoryFromCsv } from "./inventoryFromCsv";

const path = process.argv[2];
if (!path) {
  console.error("Usage: npm run inventory:import -- path/to/inventory.csv");
  process.exit(1);
}

try {
  const inventory = inventoryFromCsv(await readFile(path, "utf8"));
  await writeInventory(inventory);
  console.log(`Imported ${inventory.games.length} base games from ${path}.`);
} catch (error) {
  console.error(formatZodError(error));
  process.exitCode = 1;
}
