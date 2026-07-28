import { describe, expect, it } from "vitest";
import { parseInventory } from "../../src/lib/schema";

const game = (slug: string, bggId: number) => ({
  slug,
  bggId,
  name: slug,
  quantity: 1,
  availability: "available",
  learned: false,
  house: {
    modes: [],
    moods: [],
    accessibilityFlags: [],
    contentFlags: []
  },
  expansions: []
});

describe("inventory schema", () => {
  it("accepts an empty inventory", () => {
    expect(parseInventory({ version: 1, games: [] })).toEqual({ version: 1, games: [] });
  });

  it("rejects duplicate BGG IDs and slugs", () => {
    expect(() =>
      parseInventory({ version: 1, games: [game("same", 10), game("same", 10)] })
    ).toThrow();
  });

  it("rejects inverted override ranges", () => {
    expect(() =>
      parseInventory({
        version: 1,
        games: [{ ...game("range", 10), overrides: { minPlayers: 5, maxPlayers: 2 } }]
      })
    ).toThrow(/minPlayers/);
  });
});
