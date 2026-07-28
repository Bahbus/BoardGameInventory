import { formatZodError, readInventory } from "./inventoryIo";

try {
  const inventory = await readInventory();
  const expansionCount = inventory.games.reduce((count, game) => count + game.expansions.length, 0);
  console.log(
    `Inventory is valid: ${inventory.games.length} base games and ${expansionCount} expansions.`
  );
} catch (error) {
  console.error(formatZodError(error));
  process.exitCode = 1;
}
