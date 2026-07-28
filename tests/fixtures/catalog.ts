import type { CatalogPayload } from "../../src/types";

export const catalogFixture: CatalogPayload = {
  schemaVersion: 1,
  refreshedAt: new Date().toISOString(),
  enriched: true,
  games: [
    {
      slug: "forest-council",
      bggId: 101,
      name: "Forest Council",
      quantity: 1,
      shelf: "A3",
      availability: "available",
      learned: true,
      house: {
        rating: 5,
        setupMinutes: 8,
        teachDifficulty: 2,
        tableSpace: "standard",
        interaction: 4,
        luck: 2,
        downtime: 2,
        modes: ["cooperative"],
        moods: ["social", "strategic"],
        accessibilityFlags: [],
        contentFlags: []
      },
      expansions: [
        {
          slug: "moonlit-paths",
          bggId: 102,
          name: "Moonlit Paths",
          standalone: false,
          quantity: 1,
          availability: "available",
          learned: true,
          metadata: {
            bggId: 102,
            name: "Moonlit Paths",
            categories: ["Fantasy"],
            mechanics: ["Tile Placement"],
            modes: ["cooperative"],
            playerRecommendations: [],
            url: "https://boardgamegeek.com/boardgame/102"
          }
        },
        {
          slug: "fox-den",
          bggId: 103,
          name: "Fox Den",
          standalone: true,
          quantity: 1,
          availability: "available",
          learned: true,
          metadata: {
            bggId: 103,
            name: "Fox Den",
            minPlayers: 1,
            maxPlayers: 2,
            minMinutes: 20,
            maxMinutes: 30,
            complexity: 1.8,
            categories: ["Animals"],
            mechanics: ["Set Collection"],
            modes: ["competitive"],
            playerRecommendations: [{ playerCount: 2, rating: "best" }],
            url: "https://boardgamegeek.com/boardgame/103"
          }
        }
      ],
      metadata: {
        bggId: 101,
        name: "Forest Council",
        yearPublished: 2022,
        minPlayers: 2,
        maxPlayers: 5,
        minMinutes: 45,
        maxMinutes: 75,
        minAge: 10,
        complexity: 3,
        rating: 8.1,
        rank: 120,
        categories: ["Fantasy", "Animals"],
        mechanics: ["Worker Placement", "Negotiation"],
        modes: ["cooperative"],
        playerRecommendations: [
          { playerCount: 4, rating: "best" },
          { playerCount: 5, rating: "recommended" }
        ],
        url: "https://boardgamegeek.com/boardgame/101"
      }
    },
    {
      slug: "rocket-racers",
      bggId: 201,
      name: "Rocket Racers",
      quantity: 1,
      shelf: "B1",
      availability: "available",
      learned: false,
      house: {
        rating: 3,
        setupMinutes: 3,
        teachDifficulty: 1,
        tableSpace: "compact",
        interaction: 3,
        luck: 5,
        downtime: 1,
        modes: ["competitive"],
        moods: ["casual", "chaotic"],
        accessibilityFlags: ["color-dependent"],
        contentFlags: []
      },
      expansions: [],
      metadata: {
        bggId: 201,
        name: "Rocket Racers",
        yearPublished: 2020,
        minPlayers: 2,
        maxPlayers: 8,
        minMinutes: 15,
        maxMinutes: 30,
        minAge: 7,
        complexity: 1.3,
        rating: 7.2,
        categories: ["Racing", "Science Fiction"],
        mechanics: ["Dice Rolling"],
        modes: ["competitive"],
        playerRecommendations: [{ playerCount: 6, rating: "best" }],
        url: "https://boardgamegeek.com/boardgame/201"
      }
    }
  ]
};
