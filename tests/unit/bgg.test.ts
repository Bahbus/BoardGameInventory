import { describe, expect, it } from "vitest";
import { fetchBggMetadata, parseBggThings } from "../../scripts/bgg";

const xml = `<?xml version="1.0" encoding="utf-8"?>
<items>
  <item type="boardgame" id="101">
    <thumbnail>https://cf.geekdo-images.com/thumb.jpg</thumbnail>
    <image>https://cf.geekdo-images.com/image.jpg</image>
    <name type="primary" value="Forest Council"/>
    <yearpublished value="2022"/>
    <minplayers value="2"/>
    <maxplayers value="5"/>
    <minplaytime value="45"/>
    <maxplaytime value="75"/>
    <minage value="10"/>
    <link type="boardgamecategory" id="1" value="Fantasy"/>
    <link type="boardgamemechanic" id="2" value="Cooperative Game"/>
    <poll name="suggested_numplayers">
      <results numplayers="4">
        <result value="Best" numvotes="12"/>
        <result value="Recommended" numvotes="4"/>
        <result value="Not Recommended" numvotes="1"/>
      </results>
    </poll>
    <statistics>
      <ratings>
        <average value="8.1"/>
        <averageweight value="3.0"/>
        <ranks><rank type="subtype" id="1" name="boardgame" friendlyname="Board Game Rank" value="120"/></ranks>
      </ratings>
    </statistics>
  </item>
</items>`;

describe("BGG enrichment", () => {
  it("parses public game fields and recommendation polls", () => {
    const [game] = parseBggThings(xml);
    expect(game).toMatchObject({
      bggId: 101,
      name: "Forest Council",
      minPlayers: 2,
      maxPlayers: 5,
      complexity: 3,
      rating: 8.1,
      rank: 120,
      categories: ["Fantasy"],
      mechanics: ["Cooperative Game"],
      modes: ["cooperative"]
    });
    expect(game.playerRecommendations).toEqual([{ playerCount: 4, rating: "best" }]);
  });

  it("retries queued responses and returns the successful payload", async () => {
    let calls = 0;
    const fetcher = async () => {
      calls += 1;
      return new Response(calls === 1 ? "" : xml, { status: calls === 1 ? 202 : 200 });
    };
    const result = await fetchBggMetadata([101], "token", fetcher as typeof fetch);
    expect(calls).toBe(2);
    expect(result.get(101)?.name).toBe("Forest Council");
  });

  it("rejects a missing BGG item", async () => {
    const fetcher = async () => new Response("<items></items>", { status: 200 });
    await expect(fetchBggMetadata([999], "token", fetcher as typeof fetch)).rejects.toThrow(
      /did not return/
    );
  });
});
