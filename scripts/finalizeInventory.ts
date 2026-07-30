import { readFile } from "node:fs/promises";
import { finalizeInventory } from "./inventoryFinalization";
import { INVENTORY_PATH, serializeInventory, writeInventory } from "./inventoryIo";

const matchingPath = new URL("../data/inventory.matching.csv", import.meta.url);
const housePath = new URL("../data/inventory.house.csv", import.meta.url);
const mode = process.argv[2];

if (!["--check", "--preview", "--write"].includes(mode)) {
  console.error(
    "Usage: npm run inventory:finalize:check, npm run inventory:finalize:preview, or npm run inventory:finalize"
  );
  process.exit(1);
}

try {
  const inventory = finalizeInventory(
    await readFile(matchingPath, "utf8"),
    await readFile(housePath, "utf8")
  );
  const expansionCount = inventory.games.reduce((total, game) => total + game.expansions.length, 0);
  if (mode === "--preview") {
    process.stdout.write(serializeInventory(inventory));
  } else if (mode === "--write") {
    await writeInventory(inventory, INVENTORY_PATH);
    console.log(
      `Finalized data/inventory.yaml with ${inventory.games.length} base games and ${expansionCount} expansions.`
    );
  } else {
    console.log(
      `Inventory inputs are complete: ${inventory.games.length} base games and ${expansionCount} expansions are ready to finalize.`
    );
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
