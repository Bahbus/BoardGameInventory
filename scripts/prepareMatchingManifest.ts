import { readFile, writeFile } from "node:fs/promises";
import { buildMatchingManifest, matchingManifestToCsv, parseIntakeCsv } from "./intakeMatching";

const intakePath = new URL("../data/inventory.intake.csv", import.meta.url);
const manifestPath = new URL("../data/inventory.matching.csv", import.meta.url);
const intake = parseIntakeCsv(await readFile(intakePath, "utf8"));
const manifest = buildMatchingManifest(intake);
await writeFile(manifestPath, matchingManifestToCsv(manifest), "utf8");

const counts = new Map<string, number>();
manifest.forEach((row) => counts.set(row.matchStatus, (counts.get(row.matchStatus) ?? 0) + 1));
console.log(
  `Prepared ${manifest.length} rows: ${[...counts.entries()]
    .map(([status, count]) => `${count} ${status}`)
    .join(", ")}.`
);
