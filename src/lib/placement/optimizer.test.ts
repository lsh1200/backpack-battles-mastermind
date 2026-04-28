import { describe, expect, it } from "vitest";
import type { GameState } from "@/lib/core/types";
import {
  bagAwareBoard,
  classifyItemBagOccupancy,
  optimizePlacement,
  type BagAwareBoard,
} from "./optimizer";

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
  it("refuses rendered layout options and asks for confirmation when bag data is missing", () => {
    const plan = optimizePlacement({ gameState: state({}), targetItems });

    expect(plan.layoutConfidence).toBe("needs-confirmation");
    expect(plan.placementAdvice.join(" ")).toContain("Confirm bag placement and bag shape");
    expect(plan.layoutOptions).toEqual([]);
  });

  it("uses current coordinates to produce move instructions when layout is readable", () => {
    const plan = optimizePlacement({
      gameState: state({
        backpackItems: [
          {
            name: "Ranger Bag",
            location: "bag",
            itemKind: "bag",
            x: 0,
            y: 0,
            footprint: {
              source: "user-confirmed",
              cells: [
                { x: 0, y: 0 },
                { x: 1, y: 0 },
                { x: 2, y: 0 },
                { x: 3, y: 0 },
                { x: 0, y: 1 },
                { x: 1, y: 1 },
                { x: 2, y: 1 },
                { x: 3, y: 1 },
                { x: 0, y: 2 },
                { x: 1, y: 2 },
              ],
            },
          },
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

  it("generates option cells from active bag cells instead of fixed full-board coordinates", () => {
    const plan = optimizePlacement({
      gameState: state({
        backpackItems: [
          {
            name: "Ranger Bag",
            location: "bag",
            itemKind: "bag",
            x: 0,
            y: 0,
            footprint: {
              source: "local-data",
              cells: [
                { x: 0, y: 0 },
                { x: 1, y: 0 },
                { x: 0, y: 1 },
                { x: 1, y: 1 },
                { x: 0, y: 2 },
                { x: 1, y: 2 },
              ],
            },
          },
          { name: "Wooden Sword", location: "bag", x: 1, y: 1 },
          { name: "Lucky Clover", location: "bag", x: 1, y: 2 },
        ],
      }),
      targetItems,
    });

    expect(plan.layoutConfidence).toBe("considered");
    expect(plan.layoutOptions[0].cells.map((cell) => cell.item)).toContain("Broom");
    expect(plan.layoutOptions[0].cells.every((cell) => cell.x <= 1 && cell.y <= 2)).toBe(true);
    expect(plan.layoutOptions[0].cells).not.toContainEqual(
      expect.objectContaining({ item: "Broom", x: 2, y: 1 }),
    );
  });

  it("keeps oversized BPB-shaped items in storage instead of drawing them as 1x1 cells", () => {
    const plan = optimizePlacement({
      gameState: state({
        backpackItems: [
          {
            name: "Ranger Bag",
            location: "bag",
            itemKind: "bag",
            x: 0,
            y: 0,
            footprint: {
              source: "local-data",
              cells: [
                { x: 0, y: 0 },
                { x: 1, y: 0 },
                { x: 0, y: 1 },
                { x: 1, y: 1 },
                { x: 0, y: 2 },
                { x: 1, y: 2 },
              ],
            },
          },
          { name: "Wooden Sword", location: "bag", x: 1, y: 1 },
          { name: "Lucky Clover", location: "bag", x: 1, y: 2 },
        ],
      }),
      targetItems,
      itemShapes: {
        "Wooden Sword": [[1], [1]],
        "Lucky Clover": [[1]],
        Stone: [[1]],
        "Walrus Tusk": [[1], [1]],
        Broom: [[0, 1], [0, 1], [0, 1], [0, 1]],
        Banana: [
          [0, 2, 0, 0],
          [2, 1, 2, 0],
          [2, 1, 1, 2],
          [0, 2, 2, 0],
        ],
        "Shiny Shell": [[2, 1, 2]],
      },
    });

    expect(plan.layoutConfidence).toBe("considered");
    expect(plan.layoutOptions[0].cells).toContainEqual(
      expect.objectContaining({ item: "Wooden Sword", width: 1, height: 2, shape: [[1], [1]] }),
    );
    expect(plan.layoutOptions[0].cells.map((cell) => cell.item)).not.toContain("Broom");
    expect(plan.layoutOptions[0].benchItems.map((item) => item.item)).toEqual(
      expect.arrayContaining(["Broom", "Banana"]),
    );
    expect(plan.layoutOptions[0].cells).toContainEqual(
      expect.objectContaining({ item: "Shiny Shell", width: 1, height: 1, shape: [[1]] }),
    );
  });

  it("derives active cells only from a placed bag footprint", () => {
    const board = bagAwareBoard(
      state({
        backpackItems: [
          {
            name: "Ranger Bag",
            location: "bag",
            itemKind: "bag",
            x: 2,
            y: 1,
            footprint: {
              source: "user-confirmed",
              cells: [
                { x: 0, y: 0 },
                { x: 1, y: 0 },
                { x: 0, y: 1 },
              ],
            },
          },
          { name: "Wooden Sword", location: "bag", x: 2, y: 1 },
        ],
      }),
    );

    expect(board.fullBoard).toEqual({ width: 10, height: 6 });
    expect(board.activeBagCells).toEqual([
      { x: 2, y: 1 },
      { x: 3, y: 1 },
      { x: 2, y: 2 },
    ]);
    expect(board.usableCellKeys.has("0,0")).toBe(false);
    expect(board.unusableCellKeys.has("0,0")).toBe(true);
    expect(board.missingBagData).toEqual([]);
  });

  it("classifies item occupancy against active bag cells", () => {
    const board: BagAwareBoard = {
      fullBoard: { width: 10, height: 6 },
      bags: [],
      activeBagCells: [
        { x: 1, y: 1 },
        { x: 2, y: 1 },
        { x: 1, y: 2 },
      ],
      usableCellKeys: new Set(["1,1", "2,1", "1,2"]),
      unusableCellKeys: new Set(),
      missingBagData: [],
    };

    expect(classifyItemBagOccupancy({ name: "Wooden Sword", location: "bag", x: 1, y: 1 }, board)).toBe(
      "inside-bag",
    );
    expect(classifyItemBagOccupancy({ name: "Stone", location: "bag", x: 5, y: 5 }, board)).toBe("outside-bag");
    expect(
      classifyItemBagOccupancy(
        {
          name: "Broom",
          location: "bag",
          x: 1,
          y: 1,
          footprint: {
            source: "local-data",
            cells: [
              { x: 0, y: 0 },
              { x: 1, y: 0 },
              { x: 2, y: 0 },
            ],
          },
        },
        board,
      ),
    ).toBe("partial");
    expect(classifyItemBagOccupancy({ name: "Banana", location: "bag" }, board)).toBe("unknown");
  });

  it("places generated layouts only inside known active bag cells", () => {
    const plan = optimizePlacement({
      gameState: state({
        backpackItems: [
          {
            name: "Ranger Bag",
            location: "bag",
            itemKind: "bag",
            x: 0,
            y: 0,
            footprint: {
              source: "user-confirmed",
              cells: [
                { x: 1, y: 1 },
                { x: 2, y: 1 },
                { x: 1, y: 0 },
              ],
            },
          },
          { name: "Wooden Sword", location: "bag", x: 1, y: 1 },
          { name: "Lucky Clover", location: "bag", x: 0, y: 2 },
        ],
      }),
      targetItems: ["Broom", "Stone"],
    });

    expect(plan.layoutConfidence).toBe("considered");
    expect(plan.placementAdvice.join(" ")).toContain("Known bag space was considered");
    expect(plan.layoutOptions[0].cells).toEqual([
      { item: "Wooden Sword", x: 1, y: 1, width: 1, height: 1, shape: [[1]], role: "primary weapon" },
      { item: "Stone", x: 1, y: 0, width: 1, height: 1, shape: [[1]], role: "weapon damage adjacency" },
      { item: "Lucky Clover", x: 2, y: 1, width: 1, height: 1, shape: [[1]], role: "luck support" },
    ]);
    expect(plan.layoutOptions[0].benchItems.map((item) => item.item)).toContain("Broom");
  });

  it("refuses exact layout options when a bag is missing placement or footprint data", () => {
    const plan = optimizePlacement({
      gameState: state({
        backpackItems: [
          { name: "Ranger Bag", location: "bag", itemKind: "bag", x: 0, y: 0 },
          { name: "Wooden Sword", location: "bag", x: 1, y: 1 },
        ],
      }),
      targetItems,
    });

    expect(plan.layoutConfidence).toBe("needs-confirmation");
    expect(plan.layoutOptions).toEqual([]);
    expect(plan.placementAdvice.join(" ")).toContain("Confirm bag placement and bag shape");
  });
});
