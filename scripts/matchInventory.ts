import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { buildMatchReport, fetchBggSearch, matchReportToCsv } from "./bggSearch";
import { parseMatchingManifest } from "./intakeMatching";

const token = process.env.BGG_API_TOKEN;
if (!token) {
  console.error("BGG_API_TOKEN is required for live matching.");
  process.exit(1);
}

const manifestPath = new URL("../data/inventory.matching.csv", import.meta.url);
const outputPath = process.argv[2] ?? "outputs/inventory-match-report.csv";
const manifest = parseMatchingManifest(await readFile(manifestPath, "utf8"));
const report = await buildMatchReport(manifest, (query) => fetchBggSearch(query, token));

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, matchReportToCsv(report), "utf8");
console.log(`Wrote ${report.length} matching decisions to ${outputPath}.`);
