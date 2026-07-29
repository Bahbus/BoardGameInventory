import { readFile, writeFile } from "node:fs/promises";
import { buildHouseIntake, houseIntakeToCsv, validateHouseIntakeCsv } from "./houseIntake";
import { parseMatchingManifest } from "./intakeMatching";

const manifestPath = new URL("../data/inventory.matching.csv", import.meta.url);
const outputPath = new URL("../data/inventory.house.csv", import.meta.url);
const manifest = parseMatchingManifest(await readFile(manifestPath, "utf8"));
const source = houseIntakeToCsv(buildHouseIntake(manifest));
const validated = validateHouseIntakeCsv(source);
await writeFile(outputPath, source, "utf8");
console.log(`Prepared house questionnaire for ${validated.length} selectable games.`);
