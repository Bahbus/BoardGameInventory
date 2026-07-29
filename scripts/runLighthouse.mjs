import { spawn, spawnSync } from "node:child_process";
import { copyFile, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import lighthouse from "lighthouse";
import * as chromeLauncher from "chrome-launcher";
import { chromium } from "@playwright/test";

const url = "http://127.0.0.1:4173/BoardGameInventory/";
const build = spawnSync("npm", ["run", "build"], {
  stdio: "inherit",
  env: { ...process.env, GITHUB_ACTIONS: "true" }
});
if (build.status !== 0) process.exit(build.status ?? 1);
await copyFile("tests/fixtures/catalog.lighthouse.json", "dist/catalog.json");
const server = spawn("npm", ["run", "preview", "--", "--host", "127.0.0.1", "--port", "4173"], {
  stdio: "inherit",
  env: { ...process.env, GITHUB_ACTIONS: "true" }
});
let chrome;
const temporary = await mkdtemp(join(tmpdir(), "board-game-lighthouse-"));

try {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) break;
    } catch {
      // The preview process is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  chrome = await chromeLauncher.launch({
    chromePath: chromium.executablePath(),
    chromeFlags: ["--headless", "--no-sandbox", `--user-data-dir=${temporary}`]
  });
  const result = await lighthouse(url, {
    port: chrome.port,
    output: "json",
    logLevel: "error",
    onlyCategories: ["performance", "accessibility", "best-practices", "seo"]
  });
  if (!result) throw new Error("Lighthouse did not produce a report.");
  await writeFile("lighthouse-report.json", result.report, "utf8");

  const scores = Object.fromEntries(
    Object.entries(result.lhr.categories).map(([key, category]) => [key, category.score ?? 0])
  );
  for (const [category, score] of Object.entries(scores)) {
    console.log(`${category}: ${Math.round(score * 100)}`);
    if (score < 0.9) throw new Error(`${category} Lighthouse score is below 90.`);
  }
} finally {
  if (chrome) await chrome.kill();
  server.kill("SIGTERM");
  await rm(temporary, { recursive: true, force: true });
}
