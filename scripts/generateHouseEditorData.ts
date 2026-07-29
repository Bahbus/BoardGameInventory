import { mkdir, readFile, writeFile } from "node:fs/promises";
import { validateHouseIntakeCsv } from "./houseIntake";

const source = await readFile(new URL("../data/inventory.house.csv", import.meta.url), "utf8");
const games = validateHouseIntakeCsv(source);
const output = new URL("../public/house-intake.json", import.meta.url);
await mkdir(new URL("../public/", import.meta.url), { recursive: true });
await writeFile(output, `${JSON.stringify({ schemaVersion: 1, games }, null, 2)}\n`, "utf8");
console.log(`Generated browser questionnaire for ${games.length} games.`);
