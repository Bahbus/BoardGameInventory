import type { Availability, InventoryGame, OwnedExpansion } from "../src/types";
import { formatZodError, readInventory, writeInventory } from "./inventoryIo";
import { fieldsFromIssue } from "./issueRequest";

type Operation = "add" | "update" | "remove";

const integer = (value: string | undefined, label: string) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0)
    throw new Error(`${label} must be a positive integer.`);
  return parsed;
};

const optionalNumber = (value: string | undefined) => {
  if (!value) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`Expected a number, received "${value}".`);
  return parsed;
};

const boolean = (value: string | undefined) =>
  value?.toLocaleLowerCase() === "true" || value?.includes("[x]") || value === "Yes";

const operation = process.env.REQUEST_OPERATION as Operation | undefined;
const body = process.env.ISSUE_BODY ?? "";
if (!operation || !["add", "update", "remove"].includes(operation)) {
  console.error("REQUEST_OPERATION must be add, update, or remove.");
  process.exit(1);
}

try {
  const inventory = await readInventory();
  const fields = fieldsFromIssue(body);
  const bggId = integer(fields.get("BGG ID"), "BGG ID");
  const locate = () => {
    const base = inventory.games.find((game) => game.bggId === bggId);
    if (base) return { kind: "game" as const, base };
    for (const parent of inventory.games) {
      const expansion = parent.expansions.find((item) => item.bggId === bggId);
      if (expansion) return { kind: "expansion" as const, base: parent, expansion };
    }
    return undefined;
  };

  if (operation === "add") {
    if (locate()) throw new Error(`BGG ID ${bggId} is already in the inventory.`);
    const name = fields.get("Game name");
    const slug = fields.get("Stable slug");
    if (!name || !slug) throw new Error("Game name and Stable slug are required.");
    const parentValue = fields.get("Parent BGG ID");
    const parentBggId = parentValue ? integer(parentValue, "Parent BGG ID") : undefined;
    const availability = (fields.get("Availability") ?? "available") as Availability;
    const shared = {
      slug,
      bggId,
      name,
      edition: fields.get("Edition"),
      quantity: optionalNumber(fields.get("Quantity")) ?? 1,
      shelf: fields.get("Shelf label"),
      availability,
      learned: boolean(fields.get("Learned")),
      ownershipNotes: fields.get("Ownership notes")
    };
    if (parentBggId !== undefined) {
      const parent = inventory.games.find((game) => game.bggId === parentBggId);
      if (!parent) throw new Error(`Parent BGG ID ${parentBggId} is not in the inventory.`);
      const expansion: OwnedExpansion = {
        ...shared,
        standalone: boolean(fields.get("Standalone"))
      };
      parent.expansions.push(expansion);
      parent.expansions.sort((left, right) => left.name.localeCompare(right.name));
    } else {
      const game: InventoryGame = {
        ...shared,
        house: {
          rating: optionalNumber(fields.get("House rating")),
          setupMinutes: optionalNumber(fields.get("Setup minutes")),
          teachDifficulty: optionalNumber(fields.get("Teach difficulty")),
          modes: [],
          moods: [],
          accessibilityFlags: [],
          contentFlags: [],
          recommendationNotes: fields.get("Recommendation notes")
        },
        expansions: []
      };
      inventory.games.push(game);
      inventory.games.sort((left, right) => left.name.localeCompare(right.name));
    }
  } else if (operation === "update") {
    const found = locate();
    if (!found) throw new Error(`BGG ID ${bggId} is not in the inventory.`);
    const target = found.kind === "game" ? found.base : found.expansion;
    const name = fields.get("Game name");
    const shelf = fields.get("Shelf label");
    const availability = fields.get("Availability");
    const notes = fields.get("Ownership notes");
    if (name) target.name = name;
    if (shelf) target.shelf = shelf === "(clear)" ? undefined : shelf;
    if (availability) target.availability = availability as Availability;
    if (fields.has("Learned")) target.learned = boolean(fields.get("Learned"));
    if (notes) target.ownershipNotes = notes === "(clear)" ? undefined : notes;
    if (found.kind === "game") {
      const rating = optionalNumber(fields.get("House rating"));
      const setup = optionalNumber(fields.get("Setup minutes"));
      const teach = optionalNumber(fields.get("Teach difficulty"));
      if (rating !== undefined) found.base.house.rating = rating;
      if (setup !== undefined) found.base.house.setupMinutes = setup;
      if (teach !== undefined) found.base.house.teachDifficulty = teach;
      const recommendation = fields.get("Recommendation notes");
      if (recommendation)
        found.base.house.recommendationNotes =
          recommendation === "(clear)" ? undefined : recommendation;
    }
  } else {
    const found = locate();
    if (!found) throw new Error(`BGG ID ${bggId} is not in the inventory.`);
    if (!boolean(fields.get("Confirm removal"))) {
      throw new Error("The removal confirmation must be checked.");
    }
    if (found.kind === "game") {
      inventory.games = inventory.games.filter((game) => game.bggId !== bggId);
    } else {
      found.base.expansions = found.base.expansions.filter((item) => item.bggId !== bggId);
    }
  }

  await writeInventory(inventory);
  console.log(`${operation} request applied for BGG ID ${bggId}.`);
} catch (error) {
  console.error(formatZodError(error));
  process.exitCode = 1;
}
