import { formatZodError, readInventory, writeInventory } from "./inventoryIo";
import { applyInventoryTransaction, type InventoryOperation } from "./inventoryTransaction";

const operation = process.env.REQUEST_OPERATION as InventoryOperation | undefined;
const body = process.env.ISSUE_BODY ?? "";
if (!operation || !["add", "update", "remove"].includes(operation)) {
  console.error("REQUEST_OPERATION must be add, update, or remove.");
  process.exit(1);
}

try {
  const inventory = await readInventory();
  const updated = applyInventoryTransaction(inventory, operation, body);
  await writeInventory(updated);
  console.log(`${operation} inventory request applied.`);
} catch (error) {
  console.error(formatZodError(error));
  process.exitCode = 1;
}
