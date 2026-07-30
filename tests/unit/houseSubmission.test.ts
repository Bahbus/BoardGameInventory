// @vitest-environment node

import { describe, expect, it } from "vitest";
import { houseIntakeToCsv, type HouseIntakeRow } from "../../scripts/houseIntake";
import { questionnaireFromCsv, validateHouseSubmission } from "../../service/houseSubmission";
import { SOURCE_SHA } from "../fixtures/setupService";

const row = (overrides: Partial<HouseIntakeRow> = {}): HouseIntakeRow => ({
  slug: "example-game",
  title: "Example Game",
  availability: "available",
  learned: "",
  shelf: "",
  houseRating: "",
  setupMinutes: "",
  teachDifficulty: "",
  tableSpace: "",
  interaction: "",
  luck: "",
  downtime: "",
  modes: "",
  moods: "",
  accessibilityFlags: "",
  contentFlags: "",
  recommendationNotes: "",
  localValuesRequired: "no",
  localMinPlayers: "",
  localMaxPlayers: "",
  localMinMinutes: "",
  localMaxMinutes: "",
  localMinAge: "",
  ...overrides
});

describe("guided setup submissions", () => {
  it("creates a versioned questionnaire tied to the source blob", () => {
    expect(questionnaireFromCsv(SOURCE_SHA, houseIntakeToCsv([row()]))).toMatchObject({
      schemaVersion: 1,
      sourceSha: SOURCE_SHA,
      games: [{ slug: "example-game", title: "Example Game" }]
    });
  });

  it("accepts complete answers and emits deterministic CSV", () => {
    const current = houseIntakeToCsv([row()]);
    const submitted = houseIntakeToCsv([
      row({ learned: "yes", modes: "cooperative", moods: "cozy;strategic" })
    ]);
    const result = validateHouseSubmission(current, submitted);
    expect(result.csv).toBe(submitted);
  });

  it("rejects protected identity changes and incomplete local-only games", () => {
    const current = houseIntakeToCsv([
      row({
        localValuesRequired: "yes"
      })
    ]);
    expect(() =>
      validateHouseSubmission(
        current,
        houseIntakeToCsv([
          row({
            title: "Renamed",
            learned: "yes",
            localValuesRequired: "yes"
          })
        ])
      )
    ).toThrow(/protected identity/);
    expect(() =>
      validateHouseSubmission(
        current,
        houseIntakeToCsv([row({ learned: "yes", localValuesRequired: "yes" })])
      )
    ).toThrow(/every local filter value/);
  });

  it("rejects spreadsheet formulas, unknown modes, and inverted ranges", () => {
    const current = houseIntakeToCsv([row({ localValuesRequired: "yes" })]);
    const completeLocal = {
      learned: "yes",
      localValuesRequired: "yes",
      localMinPlayers: "2",
      localMaxPlayers: "4",
      localMinMinutes: "30",
      localMaxMinutes: "60",
      localMinAge: "10"
    };
    expect(() =>
      validateHouseSubmission(
        current,
        houseIntakeToCsv([row({ ...completeLocal, shelf: '=HYPERLINK("bad")' })])
      )
    ).toThrow(/unsafe spreadsheet formula/);
    expect(() =>
      validateHouseSubmission(current, houseIntakeToCsv([row({ ...completeLocal, modes: "solo" })]))
    ).toThrow(/invalid game mode/);
    expect(() =>
      validateHouseSubmission(
        current,
        houseIntakeToCsv([row({ ...completeLocal, localMinPlayers: "5", localMaxPlayers: "2" })])
      )
    ).toThrow(/inverted player range/);
  });
});
