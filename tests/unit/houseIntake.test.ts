import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  buildHouseIntake,
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

  it("rejects invalid rating scales", async () => {
    const manifest = parseMatchingManifest(await readFile("data/inventory.matching.csv", "utf8"));
    const source = houseIntakeToCsv(buildHouseIntake(manifest)).replace(
      "ticket-to-ride,Ticket to Ride,available,,,",
      "ticket-to-ride,Ticket to Ride,available,,,6"
    );
    expect(() => validateHouseIntakeCsv(source)).toThrow(/house_rating/);
  });
});
