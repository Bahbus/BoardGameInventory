import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { inventoryFromCsv } from "../../scripts/inventoryFromCsv";

const header =
  "kind,slug,bgg_id,source_url,name,parent_slug,parent_bgg_id,standalone,edition,quantity,shelf,availability,learned,house_rating,setup_time_range,teach_difficulty,table_space,interaction,luck,downtime,modes,moods,accessibility_flags,content_flags,recommendation_notes,override_min_players,override_max_players,override_min_minutes,override_max_minutes,override_min_age";

const row = (values: Record<string, string>) =>
  header
    .split(",")
    .map((field) => values[field] ?? "")
    .join(",");

describe("CSV inventory import", () => {
  it("accepts the complete example file and attaches expansions by parent slug", async () => {
    const source = await readFile("data/inventory.example.csv", "utf8");
    const inventory = inventoryFromCsv(source);

    expect(inventory.games).toHaveLength(2);
    expect(inventory.games.find((game) => game.slug === "example-game")?.expansions).toHaveLength(
      1
    );
    expect(inventory.games.find((game) => game.slug === "local-party-game")?.bggId).toBeUndefined();
  });

  it("reports the row and every missing local-only requirement", () => {
    const incomplete = `${header}\n${["game", "local", ...Array(28).fill("")].join(",")}\n`;

    expect(() => inventoryFromCsv(incomplete)).toThrow(
      /Row 2: a local-only item without bgg_id requires source_url, override_min_players, override_max_players, override_min_minutes, override_max_minutes, override_min_age/
    );
  });

  it("rejects an expansion whose parent was not imported", () => {
    const orphan = `${header}\nexpansion,orphan,2,,Orphan,missing,,false,,1,,available,false,,,,,,,,,,,,,,,,,\n`;

    expect(() => inventoryFromCsv(orphan)).toThrow(/Row 2: the expansion parent was not imported/);
  });

  it("reports an invalid setup-time range on its source row", () => {
    const source = `${header}\n${row({
      kind: "game",
      slug: "bad-setup",
      bgg_id: "1",
      name: "Bad Setup",
      setup_time_range: "about ten"
    })}\n`;

    expect(() => inventoryFromCsv(source)).toThrow(/Row 2: setup_time_range is invalid/);
  });

  it("lets a non-standalone local expansion inherit its imported parent's filter values", () => {
    const source = `${header}
${row({ kind: "game", slug: "base", bgg_id: "1", name: "Base" })}
${row({
  kind: "expansion",
  slug: "bundled-module",
  source_url: "https://publisher.example/base",
  name: "Bundled Module",
  parent_slug: "base",
  standalone: "false"
})}
`;

    expect(inventoryFromCsv(source).games[0].expansions[0]).toMatchObject({
      slug: "bundled-module",
      standalone: false
    });
  });
});
