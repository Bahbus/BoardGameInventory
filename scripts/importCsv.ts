import { readFile } from "node:fs/promises";
import type {
  Availability,
  GameMode,
  Inventory,
  InventoryGame,
  OwnedExpansion,
  TableSpace,
  ValueOverrides
} from "../src/types";
import { parseInventory } from "../src/lib/schema";
import { csvRecords } from "./csv";
import { formatZodError, writeInventory } from "./inventoryIo";

const path = process.argv[2];
if (!path) {
  console.error("Usage: npm run inventory:import -- path/to/inventory.csv");
  process.exit(1);
}

const list = (value: string) =>
  value
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean);
const number = (value: string) => (value ? Number(value) : undefined);
const boolean = (value: string) => value.toLocaleLowerCase() === "true";
const optional = (value: string) => value || undefined;
const overrides = (row: Record<string, string>): ValueOverrides | undefined => {
  const value = {
    minPlayers: number(row.override_min_players),
    maxPlayers: number(row.override_max_players),
    minMinutes: number(row.override_min_minutes),
    maxMinutes: number(row.override_max_minutes),
    minAge: number(row.override_min_age)
  };
  return Object.values(value).some((item) => item !== undefined) ? value : undefined;
};

try {
  const rows = csvRecords(await readFile(path, "utf8"));
  const games: InventoryGame[] = [];
  const expansions: Array<{ parentBggId: number; expansion: OwnedExpansion; row: number }> = [];
  const rowErrors: string[] = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const bggId = Number(row.bgg_id);
    if (!Number.isInteger(bggId) || bggId <= 0) {
      rowErrors.push(`Row ${rowNumber}: bgg_id must be a positive integer.`);
      return;
    }
    if (row.kind === "game") {
      games.push({
        slug: row.slug,
        bggId,
        name: row.name,
        edition: optional(row.edition),
        quantity: number(row.quantity) ?? 1,
        shelf: optional(row.shelf),
        availability: (row.availability || "available") as Availability,
        learned: boolean(row.learned),
        house: {
          rating: number(row.house_rating),
          setupMinutes: number(row.setup_minutes),
          teachDifficulty: number(row.teach_difficulty),
          tableSpace: optional(row.table_space) as TableSpace | undefined,
          interaction: number(row.interaction),
          luck: number(row.luck),
          downtime: number(row.downtime),
          modes: list(row.modes) as GameMode[],
          moods: list(row.moods),
          accessibilityFlags: list(row.accessibility_flags),
          contentFlags: list(row.content_flags),
          recommendationNotes: optional(row.recommendation_notes)
        },
        overrides: overrides(row),
        expansions: []
      });
    } else if (row.kind === "expansion") {
      const parentBggId = Number(row.parent_bgg_id);
      if (!Number.isInteger(parentBggId) || parentBggId <= 0) {
        rowErrors.push(`Row ${rowNumber}: an expansion requires a valid parent_bgg_id.`);
        return;
      }
      expansions.push({
        parentBggId,
        row: rowNumber,
        expansion: {
          slug: row.slug,
          bggId,
          name: row.name,
          standalone: boolean(row.standalone),
          edition: optional(row.edition),
          quantity: number(row.quantity) ?? 1,
          shelf: optional(row.shelf),
          availability: (row.availability || "available") as Availability,
          learned: boolean(row.learned),
          overrides: overrides(row)
        }
      });
    } else {
      rowErrors.push(`Row ${rowNumber}: kind must be "game" or "expansion".`);
    }
  });

  expansions.forEach(({ parentBggId, expansion, row }) => {
    const parent = games.find((game) => game.bggId === parentBggId);
    if (!parent) rowErrors.push(`Row ${row}: parent BGG ID ${parentBggId} was not imported.`);
    else parent.expansions.push(expansion);
  });
  if (rowErrors.length) throw new Error(rowErrors.join("\n"));

  games.sort((left, right) => left.name.localeCompare(right.name));
  games.forEach((game) =>
    game.expansions.sort((left, right) => left.name.localeCompare(right.name))
  );
  const inventory = parseInventory({ version: 1, games }) as Inventory;
  await writeInventory(inventory);
  console.log(`Imported ${games.length} base games from ${path}.`);
} catch (error) {
  console.error(formatZodError(error));
  process.exitCode = 1;
}
