import { describe, expect, it } from "vitest";
import {
  createStandalonePlayModes,
  filterAndScore,
  isEligible,
  scoreGame,
  weightedDraw
} from "../../src/lib/catalog";
import { DEFAULT_PREFERENCES } from "../../src/lib/preferences";
import { catalogFixture } from "../fixtures/catalog";

const forest = catalogFixture.games[0];
const racers = catalogFixture.games[1];

describe("catalog filtering and scoring", () => {
  it("enforces player count, availability, and learned requirements", () => {
    expect(isEligible(forest, { ...DEFAULT_PREFERENCES, players: 5, learnedOnly: true })).toBe(
      true
    );
    expect(isEligible(racers, { ...DEFAULT_PREFERENCES, players: 6, learnedOnly: true })).toBe(
      false
    );
    expect(isEligible(forest, { ...DEFAULT_PREFERENCES, players: 9 })).toBe(false);
  });

  it("treats missing soft metadata as neutral", () => {
    const neutral = scoreGame(
      {
        ...forest,
        house: { ...forest.house, rating: undefined },
        metadata: { ...forest.metadata, playerRecommendations: [] }
      },
      DEFAULT_PREFERENCES
    );
    expect(neutral.matchScore).toBe(0.5);
    expect(neutral.rouletteWeight).toBe(2);
  });

  it("uses the documented exact weight for a perfect match", () => {
    const result = scoreGame(forest, {
      ...DEFAULT_PREFERENCES,
      players: 4,
      targetComplexity: 3,
      preferredMoods: ["social"]
    });
    expect(result.matchScore).toBe(1);
    expect(result.rouletteWeight).toBe(5);
  });

  it("draws deterministically and resets exclusions after exhaustion", () => {
    const games = filterAndScore([forest, racers], DEFAULT_PREFERENCES);
    expect(weightedDraw(games, new Set(), () => 0)?.game.slug).toBe("forest-council");
    expect(weightedDraw(games, new Set(["forest-council"]), () => 0)?.game.slug).toBe(
      "rocket-racers"
    );
    expect(
      weightedDraw(games, new Set(["forest-council", "rocket-racers"]), () => 0)?.game.slug
    ).toBe("forest-council");
  });

  it("creates a selectable mode only for standalone expansions", () => {
    const modes = createStandalonePlayModes([forest]);
    expect(modes.map((game) => game.name)).toEqual(["Forest Council", "Forest Council: Fox Den"]);
  });
});
