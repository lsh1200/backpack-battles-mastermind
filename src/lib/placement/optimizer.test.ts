import { describe, expect, it } from "vitest";
import type { GameState } from "@/lib/core/types";
import { optimizePlacement } from "./optimizer";

function state(overrides: Partial<GameState>): GameState {
  return {
    round: 1,
    gold: 13,
    lives: 5,
    wins: 0,
    className: "Ranger",
    bagChoice: "Ranger Bag",
    skills: [],
    subclass: null,
    shopItems: [
      { name: "Stone", slot: "top-right", sale: false, price: 1 },
      { name: "Banana", slot: "middle-left", sale: false, price: 3 },
      { name: "Shiny Shell", slot: "middle-right", sale: true, price: 1 },
      { name: "Broom", slot: "bottom-center", sale: false, price: 4 },
      { name: "Walrus Tusk", slot: "bottom-right", sale: false, price: 4 },
    ],
    backpackItems: [
      { name: "Ranger Bag", location: "bag" },
      { name: "Wooden Sword", location: "bag" },
      { name: "Lucky Clover", location: "bag" },
    ],
    storageItems: [],
    userGoal: "learn",
    uncertainFields: [],
    ...overrides,
  };
}

const targetItems = ["Broom", "Banana", "Stone", "Shiny Shell", "Walrus Tusk"];

describe("optimizePlacement", () => {
  it("returns rendered layout options but asks for confirmation when current coordinates are missing", () => {
    const plan = optimizePlacement({ gameState: state({}), targetItems });

    expect(plan.layoutConfidence).toBe("needs-confirmation");
    expect(plan.placementAdvice.join(" ")).toContain("confirm current item positions");
    expect(plan.layoutOptions).toHaveLength(2);
    expect(plan.layoutOptions[0].title).toBe("Tempo Weapons");
    expect(plan.layoutOptions[0].cells.map((cell) => cell.item)).toContain("Broom");
  });

  it("uses current coordinates to produce move instructions when layout is readable", () => {
    const plan = optimizePlacement({
      gameState: state({
        backpackItems: [
          { name: "Ranger Bag", location: "bag", x: 0, y: 0 },
          { name: "Wooden Sword", location: "bag", x: 1, y: 1 },
          { name: "Lucky Clover", location: "bag", x: 0, y: 2 },
        ],
      }),
      targetItems,
    });

    expect(plan.layoutConfidence).toBe("considered");
    expect(plan.layoutOptions).toHaveLength(2);
    expect(plan.layoutOptions[0].moves).toContain("Keep Wooden Sword at (1, 1).");
    expect(plan.layoutOptions[0].moves).toContain("Place Broom at (2, 1) as your second active weapon.");
    expect(plan.layoutOptions[1].tradeoffs.join(" ")).toContain("safer stamina");
  });
});
