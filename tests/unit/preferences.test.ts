import { describe, expect, it } from "vitest";
import {
  DEFAULT_PREFERENCES,
  parsePreferences,
  serializePreferences
} from "../../src/lib/preferences";

describe("shareable preferences", () => {
  it("round-trips versioned state", () => {
    const expected = {
      ...DEFAULT_PREFERENCES,
      players: 6,
      maxMinutes: 90,
      requiredMode: "team" as const,
      preferredMoods: ["social", "chaotic"],
      targetComplexity: 2.5,
      learnedOnly: true
    };
    expect(parsePreferences(serializePreferences(expected))).toEqual(expected);
  });

  it("falls back safely for an unknown schema version", () => {
    expect(parsePreferences("v=999&players=6")).toEqual(DEFAULT_PREFERENCES);
  });
});
