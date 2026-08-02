import { execFileSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { serializeServiceRevision } from "./serviceRevision";

const revision =
  process.env.SETUP_SERVICE_REVISION ??
  execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();

await writeFile("netlify/public/revision.json", serializeServiceRevision(revision), "utf8");
console.log(`Prepared Setup service revision ${revision.slice(0, 12)}.`);
