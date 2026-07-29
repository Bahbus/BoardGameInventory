import type { Availability, InventoryGame, OwnedExpansion, ValueOverrides } from "../src/types";
import { formatZodError, readInventory, writeInventory } from "./inventoryIo";
import { fieldsFromIssue } from "./issueRequest";

type Operation = "add" | "update" | "remove";

const integer = (value: string | undefined, label: string) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0)
    throw new Error(`${label} must be a positive integer.`);
  return parsed;
};

const optionalInteger = (value: string | undefined, label: string) =>
  value ? integer(value, label) : undefined;

const optionalNumber = (value: string | undefined) => {
  if (!value) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`Expected a number, received "${value}".`);
  return parsed;
};

const boolean = (value: string | undefined) =>
  value?.toLocaleLowerCase() === "true" || value?.includes("[x]") || value === "Yes";

const overrideValues = (fields: Map<string, string>): ValueOverrides => ({
  minPlayers: optionalInteger(fields.get("Minimum players"), "Minimum players"),
  maxPlayers: optionalInteger(fields.get("Maximum players"), "Maximum players"),
  minMinutes: optionalNumber(fields.get("Minimum minutes")),
  maxMinutes: optionalNumber(fields.get("Maximum minutes")),
  minAge: optionalNumber(fields.get("Minimum age"))
});

const operation = process.env.REQUEST_OPERATION as Operation | undefined;
const body = process.env.ISSUE_BODY ?? "";
if (!operation || !["add", "update", "remove"].includes(operation)) {
  console.error("REQUEST_OPERATION must be add, update, or remove.");
  process.exit(1);
}

try {
  const inventory = await readInventory();
  const fields = fieldsFromIssue(body);
  const bggId = optionalInteger(fields.get("BGG ID"), "BGG ID");
  const slug = fields.get("Stable slug");
  const locate = (targetSlug: string) => {
    const base = inventory.games.find((game) => game.slug === targetSlug);
    if (base) return { kind: "game" as const, base };
    for (const parent of inventory.games) {
      const expansion = parent.expansions.find((item) => item.slug === targetSlug);
      if (expansion) return { kind: "expansion" as const, base: parent, expansion };
    }
    return undefined;
  };

  if (operation === "add") {
    const name = fields.get("Game name");
    if (!name || !slug) throw new Error("Game name and Stable slug are required.");
    if (locate(slug)) throw new Error(`Slug ${slug} is already in the inventory.`);
    if (
      bggId !== undefined &&
      inventory.games.some(
        (game) =>
          game.bggId === bggId || game.expansions.some((expansion) => expansion.bggId === bggId)
      )
    ) {
      throw new Error(`BGG ID ${bggId} is already in the inventory.`);
    }
    const parentValue = fields.get("Parent BGG ID");
    const parentBggId = optionalInteger(parentValue, "Parent BGG ID");
    const parentSlug = fields.get("Parent slug");
    const availability = (fields.get("Availability") ?? "available") as Availability;
    const shared = {
      slug,
      bggId,
      sourceUrl: fields.get("Source URL"),
      name,
      edition: fields.get("Edition"),
      quantity: optionalNumber(fields.get("Quantity")) ?? 1,
      shelf: fields.get("Shelf label"),
      availability,
      learned: boolean(fields.get("Learned")),
      ownershipNotes: fields.get("Ownership notes"),
      overrides: overrideValues(fields)
    };
    if (parentSlug || parentBggId !== undefined) {
      const parentBySlug = parentSlug
        ? inventory.games.find((game) => game.slug === parentSlug)
        : undefined;
      const parentById =
        parentBggId === undefined
          ? undefined
          : inventory.games.find((game) => game.bggId === parentBggId);
      if (parentBySlug && parentById && parentBySlug !== parentById) {
        throw new Error("Parent slug and Parent BGG ID identify different games.");
      }
      const parent = parentBySlug ?? parentById;
      if (!parent) throw new Error("The requested expansion parent is not in the inventory.");
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
    if (!slug) throw new Error("Stable slug is required.");
    const found = locate(slug);
    if (!found) throw new Error(`Slug ${slug} is not in the inventory.`);
    const target = found.kind === "game" ? found.base : found.expansion;
    if (bggId !== undefined && target.bggId !== bggId) {
      throw new Error(`BGG ID ${bggId} does not match slug ${slug}.`);
    }
    const name = fields.get("Game name");
    const shelf = fields.get("Shelf label");
    const availability = fields.get("Availability");
    const notes = fields.get("Ownership notes");
    if (name) target.name = name;
    if (shelf) target.shelf = shelf === "(clear)" ? undefined : shelf;
    if (availability) target.availability = availability as Availability;
    if (fields.has("Learned")) target.learned = boolean(fields.get("Learned"));
    if (notes) target.ownershipNotes = notes === "(clear)" ? undefined : notes;
    const sourceUrl = fields.get("Source URL");
    if (sourceUrl) target.sourceUrl = sourceUrl === "(clear)" ? undefined : sourceUrl;
    const nextOverrides = overrideValues(fields);
    const overrideEntries = Object.entries(nextOverrides).filter(
      ([, value]) => value !== undefined
    );
    if (overrideEntries.length) {
      target.overrides = { ...target.overrides, ...Object.fromEntries(overrideEntries) };
    }
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
    if (!slug) throw new Error("Stable slug is required.");
    const found = locate(slug);
    if (!found) throw new Error(`Slug ${slug} is not in the inventory.`);
    const target = found.kind === "game" ? found.base : found.expansion;
    if (bggId !== undefined && target.bggId !== bggId) {
      throw new Error(`BGG ID ${bggId} does not match slug ${slug}.`);
    }
    if (!boolean(fields.get("Confirm removal"))) {
      throw new Error("The removal confirmation must be checked.");
    }
    if (found.kind === "game") {
      inventory.games = inventory.games.filter((game) => game.slug !== slug);
    } else {
      found.base.expansions = found.base.expansions.filter((item) => item.slug !== slug);
    }
  }

  await writeInventory(inventory);
  console.log(`${operation} request applied for slug ${slug}.`);
} catch (error) {
  console.error(formatZodError(error));
  process.exitCode = 1;
}
