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

  it("accepts layout-aware recommendation details", () => {
    const recommendation = RecommendationSchema.parse({
      bestAction: {
        type: "buy",
        target: "Broom, Banana",
        value: 95,
        risks: [],
        assumptions: [],
        teachingReason: "Buy early tempo.",
      },
      shortReason: "Buy early tempo.",
      rejectedAlternatives: [],
      planSupported: "Ranger weapon tempo.",
      placementAdvice: ["Place Broom as the second active weapon."],
      layoutConfidence: "considered",
      recognitionPolicy: {
        itemRecognition: "local-first",
        summary: "Item names are grounded against local BPB data before recommendation.",
        warnings: [],
      },
      layoutOptions: [
        {
          id: "tempo-weapons",
          title: "Tempo weapons",
          score: 92,
          summary: "Prioritizes two active weapons and Stone adjacency.",
          moves: ["Move Broom to (2, 1)."],
          tradeoffs: ["Less room for extra utility."],
          cells: [
            { item: "Wooden Sword", x: 1, y: 1, width: 1, height: 1, role: "primary weapon" },
            { item: "Broom", x: 2, y: 1, width: 1, height: 1, role: "second weapon" },
          ],
        },
      ],
      nextTargets: ["Start battle."],
      assumptionsMade: [],
      correctionPromptsUsed: [],
    });

    expect(recommendation.layoutConfidence).toBe("considered");
    expect(recommendation.layoutOptions[0].cells[0].item).toBe("Wooden Sword");
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
