import { describe, expect, it } from "vitest";
import type { GameState, ValidationReport } from "@/lib/core/types";
import { CorrectionQuestionSchema, GameStateSchema } from "@/lib/core/schemas";
import { applyCorrections, buildCorrectionQuestions } from "./correction";

const state: GameState = {
  round: null,
  gold: 7,
  lives: 5,
  wins: 1,
  className: "Unknown",
  bagChoice: null,
  skills: [],
  subclass: null,
  shopItems: [{ name: "Brom", slot: "shop-1", sale: false }],
  backpackItems: [],
  storageItems: [],
  userGoal: "learn",
  uncertainFields: ["className", "shopItems.0.name"],
};

const validation: ValidationReport = {
  image: { width: 2400, height: 1080, orientation: "landscape" },
  regions: [],
  warnings: [],
  requiresConfirmation: ["className"],
};

describe("correction loop", () => {
  it("builds targeted questions for uncertain fields", () => {
    const questions = buildCorrectionQuestions(state, validation, ["Broom", "Pan", "Hero Sword"]);

    expect(questions).toContainEqual({
      field: "className",
      question: "Which class are you playing?",
      options: ["Ranger", "Reaper", "Berserker", "Pyromancer", "Mage", "Adventurer", "Engineer"],
    });
    expect(questions.some((question) => question.field === "shopItems.0.name")).toBe(true);
    expect(questions).toHaveLength(2);
    questions.forEach((question) => expect(() => CorrectionQuestionSchema.parse(question)).not.toThrow());
  });

  it("keeps shop item correction questions valid when there are no known item names", () => {
    const questions = buildCorrectionQuestions(state, validation, []);
    const shopQuestion = questions.find((question) => question.field === "shopItems.0.name");

    expect(shopQuestion?.options).toEqual(["Needs manual edit"]);
    expect(() => CorrectionQuestionSchema.parse(shopQuestion)).not.toThrow();
  });

  it("uses deterministic recognition candidates before the broad BPB item list", () => {
    const questions = buildCorrectionQuestions(state, validation, ["Broom", "Pan", "Hero Sword"], {
      "shopItems.0.name": ["Stone", "Banana", "Broom"],
    });
    const shopQuestion = questions.find((question) => question.field === "shopItems.0.name");

    expect(shopQuestion?.options.slice(0, 4)).toEqual(["Stone", "Banana", "Broom", "Pan"]);
  });

  it("keeps the current tentative item name selectable when it is not in candidate options", () => {
    const luckyState: GameState = {
      ...state,
      shopItems: [],
      backpackItems: [{ name: "Lucky Clover", location: "bag", x: 2, y: 2 }],
      uncertainFields: ["backpackItems.0.name"],
    };
    const questions = buildCorrectionQuestions(luckyState, validation, ["Stone", "Wooden Sword"], {
      "backpackItems.0.name": ["Leather Bag", "Spiked Shield"],
    });
    const backpackQuestion = questions.find((question) => question.field === "backpackItems.0.name");

    expect(backpackQuestion?.options).toContain("Lucky Clover");
    expect(backpackQuestion?.options.slice(0, 3)).toEqual(["Leather Bag", "Spiked Shield", "Lucky Clover"]);
  });

  it("applies class and shop item corrections", () => {
    const corrected = applyCorrections(state, {
      className: "Ranger",
      "shopItems.0.name": "Broom",
    });

    expect(corrected.className).toBe("Ranger");
    expect(corrected.shopItems[0]?.name).toBe("Broom");
    expect(corrected.uncertainFields).toEqual([]);
    expect(() => GameStateSchema.parse(corrected)).not.toThrow();
  });

  it("builds and applies backpack item name corrections", () => {
    const backpackState: GameState = {
      ...state,
      shopItems: [],
      backpackItems: [{ name: "Unknown Item", location: "bag", x: 1, y: 1 }],
      uncertainFields: ["backpackItems.0.name"],
    };
    const questions = buildCorrectionQuestions(backpackState, validation, ["Wooden Sword", "Ranger Bag"], {
      "backpackItems.0.name": ["Wooden Sword", "Broom"],
    });
    const corrected = applyCorrections(backpackState, {
      "backpackItems.0.name": "Wooden Sword",
    });

    expect(questions.find((question) => question.field === "backpackItems.0.name")?.options.slice(0, 3)).toEqual([
      "Wooden Sword",
      "Broom",
      "Ranger Bag",
    ]);
    expect(corrected.backpackItems[0]?.name).toBe("Wooden Sword");
    expect(corrected.uncertainFields).toEqual([]);
    expect(() => GameStateSchema.parse(corrected)).not.toThrow();
  });

  it("ignores blank correction values so the game state remains valid", () => {
    const corrected = applyCorrections(state, {
      className: " ",
      "shopItems.0.name": "",
    });

    expect(corrected.className).toBe("Unknown");
    expect(corrected.shopItems[0]?.name).toBe("Brom");
    expect(corrected.uncertainFields).toEqual(["className", "shopItems.0.name"]);
    expect(() => GameStateSchema.parse(corrected)).not.toThrow();
  });

  it("clears only fields that were actually applied", () => {
    const corrected = applyCorrections(
      {
        ...state,
        uncertainFields: ["className", "round", "shopItems.0.name", "shopItems.9.name"],
      },
      {
        className: "Ranger",
        round: "5",
        "shopItems.0.name": "Broom",
        "shopItems.9.name": "Pan",
      },
    );

    expect(corrected.className).toBe("Ranger");
    expect(corrected.round).toBeNull();
    expect(corrected.shopItems[0]?.name).toBe("Broom");
    expect(corrected.uncertainFields).toEqual(["round", "shopItems.9.name"]);
    expect(() => GameStateSchema.parse(corrected)).not.toThrow();
  });

  it("does not mutate the original game state", () => {
    const corrected = applyCorrections(state, {
      className: "Ranger",
      "shopItems.0.name": "Broom",
    });

    expect(corrected).not.toBe(state);
    expect(corrected.shopItems).not.toBe(state.shopItems);
    expect(state.className).toBe("Unknown");
    expect(state.shopItems[0]?.name).toBe("Brom");
    expect(state.uncertainFields).toEqual(["className", "shopItems.0.name"]);
  });
});
