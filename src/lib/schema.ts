import { z } from "zod";
import type { Inventory } from "../types";

const availabilitySchema = z.enum(["available", "loaned", "incomplete", "unavailable"]);
const tableSpaceSchema = z.enum(["compact", "standard", "large"]);
const modeSchema = z.enum(["competitive", "cooperative", "team"]);

const overridesSchema = z
  .object({
    minPlayers: z.number().int().positive().optional(),
    maxPlayers: z.number().int().positive().optional(),
    minMinutes: z.number().int().nonnegative().optional(),
    maxMinutes: z.number().int().nonnegative().optional(),
    minAge: z.number().int().nonnegative().optional()
  })
  .superRefine((value, context) => {
    if (
      value.minPlayers !== undefined &&
      value.maxPlayers !== undefined &&
      value.minPlayers > value.maxPlayers
    ) {
      context.addIssue({
        code: "custom",
        message: "minPlayers cannot exceed maxPlayers",
        path: ["minPlayers"]
      });
    }
    if (
      value.minMinutes !== undefined &&
      value.maxMinutes !== undefined &&
      value.minMinutes > value.maxMinutes
    ) {
      context.addIssue({
        code: "custom",
        message: "minMinutes cannot exceed maxMinutes",
        path: ["minMinutes"]
      });
    }
  });

const expansionSchema = z.object({
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  bggId: z.number().int().positive(),
  name: z.string().min(1),
  standalone: z.boolean().default(false),
  edition: z.string().min(1).optional(),
  quantity: z.number().int().positive().default(1),
  shelf: z.string().min(1).optional(),
  availability: availabilitySchema.default("available"),
  learned: z.boolean().default(false),
  ownershipNotes: z.string().min(1).optional(),
  compatibilityNotes: z.string().min(1).optional(),
  overrides: overridesSchema.optional()
});

const gameSchema = z.object({
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  bggId: z.number().int().positive(),
  name: z.string().min(1),
  edition: z.string().min(1).optional(),
  quantity: z.number().int().positive().default(1),
  shelf: z.string().min(1).optional(),
  availability: availabilitySchema.default("available"),
  learned: z.boolean().default(false),
  ownershipNotes: z.string().min(1).optional(),
  house: z
    .object({
      rating: z.number().min(1).max(5).optional(),
      setupMinutes: z.number().int().nonnegative().optional(),
      teachDifficulty: z.number().min(1).max(5).optional(),
      tableSpace: tableSpaceSchema.optional(),
      interaction: z.number().min(1).max(5).optional(),
      luck: z.number().min(1).max(5).optional(),
      downtime: z.number().min(1).max(5).optional(),
      modes: z.array(modeSchema).default([]),
      moods: z.array(z.string().min(1)).default([]),
      accessibilityFlags: z.array(z.string().min(1)).default([]),
      contentFlags: z.array(z.string().min(1)).default([]),
      recommendationNotes: z.string().min(1).optional()
    })
    .default({
      modes: [],
      moods: [],
      accessibilityFlags: [],
      contentFlags: []
    }),
  overrides: overridesSchema.optional(),
  expansions: z.array(expansionSchema).default([])
});

export const inventorySchema = z
  .object({
    version: z.literal(1),
    games: z.array(gameSchema)
  })
  .superRefine((inventory, context) => {
    const slugs = new Set<string>();
    const bggIds = new Set<number>();

    inventory.games.forEach((game, gameIndex) => {
      if (slugs.has(game.slug)) {
        context.addIssue({
          code: "custom",
          message: `Duplicate slug: ${game.slug}`,
          path: ["games", gameIndex, "slug"]
        });
      }
      if (bggIds.has(game.bggId)) {
        context.addIssue({
          code: "custom",
          message: `Duplicate BGG ID: ${game.bggId}`,
          path: ["games", gameIndex, "bggId"]
        });
      }
      slugs.add(game.slug);
      bggIds.add(game.bggId);

      game.expansions.forEach((expansion, expansionIndex) => {
        if (slugs.has(expansion.slug)) {
          context.addIssue({
            code: "custom",
            message: `Duplicate slug: ${expansion.slug}`,
            path: ["games", gameIndex, "expansions", expansionIndex, "slug"]
          });
        }
        if (bggIds.has(expansion.bggId)) {
          context.addIssue({
            code: "custom",
            message: `Duplicate BGG ID: ${expansion.bggId}`,
            path: ["games", gameIndex, "expansions", expansionIndex, "bggId"]
          });
        }
        slugs.add(expansion.slug);
        bggIds.add(expansion.bggId);
      });
    });
  });

export function parseInventory(value: unknown): Inventory {
  return inventorySchema.parse(value) as Inventory;
}
