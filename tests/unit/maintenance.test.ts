import { describe, expect, it } from "vitest";
import { buildIssueUrl } from "../../src/lib/maintenance";

describe("maintenance request links", () => {
  it("prefills the matching GitHub issue form without empty values", () => {
    const url = buildIssueUrl("https://github.com/Bahbus/BoardGameInventory", {
      operation: "add",
      bggId: "68448",
      name: "7 Wonders",
      slug: "7-wonders",
      parentId: "",
      notes: ""
    });
    expect(url).toContain("template=inventory-add.yml");
    expect(url).toContain("bgg-id=68448");
    expect(url).toContain("game-name=7+Wonders");
    expect(url).not.toContain("parent-bgg-id");
  });
});
