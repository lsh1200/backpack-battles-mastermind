import { describe, expect, it } from "vitest";
import { AnalysisResultSchema, GameStateSchema, RecommendationSchema } from "./schemas";

describe("core schemas", () => {
  it("accepts a minimal corrected game state", () => {
    const state = GameStateSchema.parse({
      round: 4,
      gold: 8,
      lives: 4,
      wins: 2,
      className: "Ranger",
      bagChoice: "Ranger Bag",
      skills: [],
      subclass: null,
      shopItems: [{ name: "Broom", slot: "shop-1", sale: false }],
      backpackItems: [{ name: "Hero Sword", location: "bag", x: 1, y: 2 }],
      storageItems: [],
      userGoal: "learn",
      uncertainFields: [],
    });

    expect(state.className).toBe("Ranger");
    expect(state.shopItems[0].name).toBe("Broom");
  });

  it("rejects recommendations without a best action", () => {
    expect(() => RecommendationSchema.parse({ reason: "missing action" })).toThrow();
  });

  it("accepts the full analysis result shape", () => {
    const result = AnalysisResultSchema.parse({
      gameState: {
        round: 2,
        gold: 5,
        lives: 5,
        wins: 1,
        className: "Unknown",
        bagChoice: null,
        skills: [],
        subclass: null,
        shopItems: [],
        backpackItems: [],
        storageItems: [],
        userGoal: "learn",
        uncertainFields: ["className"],
      },
      validation: {
        image: { width: 2400, height: 1080, orientation: "landscape" },
        regions: [],
        warnings: ["class not visible"],
        requiresConfirmation: ["className"],
      },
      correctionQuestions: [
        {
          field: "className",
          question: "Which class are you playing?",
          options: ["Ranger", "Reaper", "Berserker", "Pyromancer"],
        },
      ],
      recommendation: null,
    });

    expect(result.correctionQuestions).toHaveLength(1);
  });
});
