import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  buildHouseIntake,
  houseSetupRequired,
  houseIntakeToCsv,
  validateHouseIntakeCsv
} from "../../scripts/houseIntake";
import { parseMatchingManifest } from "../../scripts/intakeMatching";

describe("house-data questionnaire", () => {
  it("creates one editable row for every selectable game", async () => {
    const manifest = parseMatchingManifest(await readFile("data/inventory.matching.csv", "utf8"));
    const expected = manifest.filter((row) => row.kind === "game");
    const rows = buildHouseIntake(manifest);

    expect(rows).toHaveLength(expected.length);
    expect(rows.every((row) => row.availability === "available")).toBe(true);
    expect(rows.every((row) => row.learned === "")).toBe(true);
    expect(new Set(rows.map((row) => row.slug)).size).toBe(rows.length);
    expect(rows.map((row) => row.title)).toEqual(
      [...rows.map((row) => row.title)].sort((left, right) =>
        left.localeCompare(right, "en", { numeric: true, sensitivity: "base" })
      )
    );
    expect(rows.filter((row) => row.title.startsWith("Dice Throne"))).toEqual([
      expect.objectContaining({ slug: "dice-throne-season-one" })
    ]);
  });

  it("flags local-only filter values and known adult content", async () => {
    const manifest = parseMatchingManifest(await readFile("data/inventory.matching.csv", "utf8"));
    const buzzed = buildHouseIntake(manifest).find((row) => row.slug === "buzzed-tower");

    expect(buzzed).toMatchObject({
      localValuesRequired: "yes",
      contentFlags: "alcohol"
    });
  });

  it("round-trips through its validated open CSV contract", async () => {
    const manifest = parseMatchingManifest(await readFile("data/inventory.matching.csv", "utf8"));
    const rows = buildHouseIntake(manifest);
    expect(validateHouseIntakeCsv(houseIntakeToCsv(rows))).toEqual(rows);
  });

  it("requires Setup only while a required answer is incomplete", async () => {
    const manifest = parseMatchingManifest(await readFile("data/inventory.matching.csv", "utf8"));
    const rows = buildHouseIntake(manifest);
    expect(houseSetupRequired(rows)).toBe(true);
    expect(
      houseSetupRequired(
        rows.map((row) => ({
          ...row,
          learned: "yes",
          modes: row.localValuesRequired === "yes" ? "competitive" : row.modes,
          localMinPlayers: row.localValuesRequired === "yes" ? "2" : row.localMinPlayers,
          localMaxPlayers: row.localValuesRequired === "yes" ? "8" : row.localMaxPlayers,
          localMinMinutes: row.localValuesRequired === "yes" ? "15" : row.localMinMinutes,
          localMaxMinutes: row.localValuesRequired === "yes" ? "30" : row.localMaxMinutes,
          localMinAge: row.localValuesRequired === "yes" ? "18" : row.localMinAge
        }))
      )
    ).toBe(false);
  });

  it("rejects invalid rating scales", async () => {
    const manifest = parseMatchingManifest(await readFile("data/inventory.matching.csv", "utf8"));
    const source = houseIntakeToCsv(buildHouseIntake(manifest)).replace(
      "ticket-to-ride,Ticket to Ride,available,,,",
      "ticket-to-ride,Ticket to Ride,available,,,6"
    );
    expect(() => validateHouseIntakeCsv(source)).toThrow(/house_rating/);
  });

  it("accepts only documented setup-time ranges", async () => {
    const manifest = parseMatchingManifest(await readFile("data/inventory.matching.csv", "utf8"));
    const rows = buildHouseIntake(manifest);
    rows[0].setupTimeRange = "11-20";
    expect(validateHouseIntakeCsv(houseIntakeToCsv(rows))[0].setupTimeRange).toBe("11-20");

    rows[0].setupTimeRange = "about fifteen";
    expect(() => validateHouseIntakeCsv(houseIntakeToCsv(rows))).toThrow(/setup_time_range/);
  });
});
