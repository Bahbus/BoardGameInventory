import { describe, expect, it } from "vitest";
import { buildIssueUrl, buildWishlistIssueUrl } from "../../src/lib/maintenance";

describe("maintenance request links", () => {
  it("prefills the matching GitHub issue form without empty values", () => {
    const url = buildIssueUrl("https://github.com/Bahbus/BoardGameInventory", {
      operation: "add",
      bggId: "68448",
      sourceUrl: "",
      name: "7 Wonders",
      slug: "7-wonders",
      parentId: "",
      parentSlug: "",
      notes: ""
    });
    expect(url).toContain("template=inventory-add.yml");
    expect(url).toContain("bgg-id=68448");
    expect(url).toContain("game-name=7+Wonders");
    expect(url).not.toContain("parent-bgg-id");
  });

  it("prefills a slug and source without inventing a BGG ID", () => {
    const url = buildIssueUrl("https://github.com/Bahbus/BoardGameInventory", {
      operation: "add",
      bggId: "",
      sourceUrl: "https://publisher.example/local-game",
      name: "Local Game",
      slug: "local-game",
      parentId: "",
      parentSlug: "",
      notes: ""
    });
    expect(url).toContain("slug=local-game");
    expect(url).toContain("source-url=https%3A%2F%2Fpublisher.example%2Flocal-game");
    expect(url).not.toContain("bgg-id");
  });
});

describe("wishlist request links", () => {
  it("opens the game-request issue form with only supplied fields", () => {
    const url = buildWishlistIssueUrl("https://github.com/Bahbus/BoardGameInventory", {
      bggId: "",
      sourceUrl: "",
      name: "Sky Team",
      notes: ""
    });
    expect(url).toContain("template=game-request.yml");
    expect(url).toContain("game-name=Sky+Team");
    expect(url).not.toContain("bgg-id");
    expect(url).not.toContain("source-url");
  });
});
