import { describe, expect, it } from "vitest";
import type { BpbCache } from "@/lib/bpb/schemas";
import type { GameState } from "@/lib/core/types";
import { recommendNextAction } from "./recommend";

const bpbCache: BpbCache = {
  fetchedAt: "2026-04-27T00:00:00.000Z",
  patchVersion: "1.1.1",
  patchDate: "2026-04-03T08:01:07.000Z",
  sourceUrls: ["https://bpb-builds.vercel.app/items"],
  items: [
    {
      id: 1,
      name: "Wooden Sword",
      aliases: ["wooden sword", "woodensword"],
      imageUrl: "https://awerc.github.io/bpb-cdn/i/WoodenSword.webp",
      grounded: true,
      type: "Melee Weapon",
      shape: [[1], [1]],
      gridWidth: 1,
      gridHeight: 2,
      tags: [],
    },
    {
      id: 44,
      name: "Broom",
      aliases: ["broom"],
      imageUrl: "https://awerc.github.io/bpb-cdn/i/Broom.webp",
      grounded: true,
      type: "Melee Weapon",
      shape: [[0, 1], [0, 1], [0, 1], [0, 1]],
      gridWidth: 2,
      gridHeight: 4,
      tags: [],
    },
    {
      id: 0,
      name: "Stone",
      aliases: ["stone"],
      imageUrl: "https://awerc.github.io/bpb-cdn/i/Stone.webp",
      grounded: true,
      shape: [[1]],
      gridWidth: 1,
      gridHeight: 1,
      tags: [],
    },
    {
      id: 5,
      name: "Banana",
      aliases: ["banana"],
      imageUrl: "https://awerc.github.io/bpb-cdn/i/Banana.webp",
      grounded: true,
      shape: [
        [0, 2, 0, 0],
        [2, 1, 2, 0],
        [2, 1, 1, 2],
        [0, 2, 2, 0],
      ],
      gridWidth: 4,
      gridHeight: 4,
      tags: [],
    },
    {
      id: 275,
      name: "Shiny Shell",
      aliases: ["shiny shell", "shinyshell"],
      imageUrl: "https://awerc.github.io/bpb-cdn/i/ShinyShell.webp",
      grounded: true,
      shape: [[2, 1, 2]],
      gridWidth: 3,
      gridHeight: 1,
      tags: [],
    },
    {
      id: 8,
      name: "Walrus Tusk",
      aliases: ["walrus tusk", "walrustusk"],
      imageUrl: "https://awerc.github.io/bpb-cdn/i/WalrusTusk.webp",
      grounded: true,
      shape: [[1], [1]],
      gridWidth: 1,
      gridHeight: 2,
      tags: [],
    },
    {
      id: 51,
      name: "Whetstone",
      aliases: ["whetstone"],
      imageUrl: "https://awerc.github.io/bpb-cdn/i/Whetstone.webp",
      grounded: true,
      tags: [],
    },
    {
      id: 91,
      name: "Mana Orb",
      aliases: ["mana orb", "manaorb"],
      imageUrl: "https://awerc.github.io/bpb-cdn/i/ManaOrb.webp",
      grounded: true,
      tags: [],
    },
    {
      id: 67,
      name: "Ranger Bag",
      aliases: ["ranger bag", "rangerbag"],
      imageUrl: "https://awerc.github.io/bpb-cdn/i/RangerBag.webp",
      grounded: true,
      type: "Bag",
      shape: [
        [1, 1],
        [1, 1],
        [1, 1],
      ],
      gridWidth: 2,
      gridHeight: 3,
      tags: [],
    },
    {
      id: 98,
      name: "Hero Sword",
      aliases: ["hero sword", "herosword"],
      imageUrl: "https://awerc.github.io/bpb-cdn/i/HeroSword.webp",
      grounded: true,
      tags: [],
    },
  ],
  builds: [],
};

function baseState(overrides: Partial<GameState>): GameState {
  return {
    round: 3,
    gold: 6,
    lives: 5,
    wins: 1,
    className: "Ranger",
    bagChoice: "Ranger Bag",
    skills: [],
    subclass: null,
    shopItems: [],
    backpackItems: [{ name: "Hero Sword", location: "bag", groundedBpbId: 98 }],
    storageItems: [],
    userGoal: "learn",
    uncertainFields: [],
    ...overrides,
  };
}

describe("recommendNextAction", () => {
  it("prioritizes sale items because they are low-risk tempo", () => {
    const recommendation = recommendNextAction({
      gameState: baseState({
        shopItems: [{ name: "Broom", slot: "shop-1", sale: true, price: 3, groundedBpbId: 44 }],
      }),
      bpbCache,
      correctionPromptsUsed: [],
    });

    expect(recommendation.bestAction.type).toBe("buy");
    expect(recommendation.bestAction.target).toContain("Broom");
    expect(recommendation.shortReason).toContain("sale");
  });

  it("recommends a round-one buy package when multiple grounded commons are affordable", () => {
    const recommendation = recommendNextAction({
      gameState: baseState({
        round: 1,
        gold: 13,
        backpackItems: [
          { name: "Ranger Bag", location: "bag" },
          { name: "Wooden Sword", location: "bag" },
          { name: "Lucky Clover", location: "bag" },
        ],
        shopItems: [
          { name: "Stone", slot: "top-right", sale: false, price: 1 },
          { name: "Banana", slot: "middle-left", sale: false, price: 3 },
          { name: "Shiny Shell", slot: "middle-right", sale: true, price: 1 },
          { name: "Broom", slot: "bottom-center", sale: false, price: 4 },
          { name: "Walrus Tusk", slot: "bottom-right", sale: false, price: 4 },
        ],
      }),
      bpbCache,
      correctionPromptsUsed: [],
    });

    expect(recommendation.bestAction.type).toBe("buy");
    expect(recommendation.bestAction.target).toBe("Broom, Banana, Stone, Shiny Shell, Walrus Tusk");
    expect(recommendation.shortReason).toContain("shopping sequence");
    expect(recommendation.bestAction.teachingReason).toContain("uses all 13 gold");
    expect(recommendation.layoutConfidence).toBe("needs-confirmation");
    expect(recommendation.recognitionPolicy.itemRecognition).toBe("mixed");
    expect(recommendation.layoutOptions).toEqual([]);
    expect(recommendation.placementAdvice).toEqual([
      "Confirm bag placement and bag shape before treating layout moves as exact.",
      "Ranger Bag placement is unknown.",
    ]);
  });

  it("marks the layout considered when backpack coordinates are available", () => {
    const recommendation = recommendNextAction({
      gameState: baseState({
        round: 1,
        gold: 13,
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
        shopItems: [
          { name: "Stone", slot: "top-right", sale: false, price: 1 },
          { name: "Banana", slot: "middle-left", sale: false, price: 3 },
          { name: "Shiny Shell", slot: "middle-right", sale: true, price: 1 },
          { name: "Broom", slot: "bottom-center", sale: false, price: 4 },
          { name: "Walrus Tusk", slot: "bottom-right", sale: false, price: 4 },
        ],
      }),
      bpbCache,
      correctionPromptsUsed: [],
    });

    expect(recommendation.layoutConfidence).toBe("considered");
    expect(recommendation.layoutOptions[0].moves).toContain("Keep Wooden Sword at (1, 1).");
  });

  it("uses BPB bag shape data when the screenshot has bag placement but no footprint", () => {
    const recommendation = recommendNextAction({
      gameState: baseState({
        round: 1,
        gold: 13,
        backpackItems: [
          { name: "Ranger Bag", location: "bag", x: 0, y: 0, groundedBpbId: 67 },
          { name: "Wooden Sword", location: "bag", x: 1, y: 1, groundedBpbId: 1 },
          { name: "Lucky Clover", location: "bag", x: 1, y: 2 },
        ],
        shopItems: [
          { name: "Stone", slot: "top-right", sale: false, price: 1 },
          { name: "Banana", slot: "middle-left", sale: false, price: 3 },
          { name: "Shiny Shell", slot: "middle-right", sale: true, price: 1 },
          { name: "Broom", slot: "bottom-center", sale: false, price: 4 },
          { name: "Walrus Tusk", slot: "bottom-right", sale: false, price: 4 },
        ],
      }),
      bpbCache,
      correctionPromptsUsed: [],
    });

    expect(recommendation.layoutConfidence).toBe("considered");
    expect(recommendation.placementAdvice.join(" ")).toContain("Known bag space was considered");
    expect(recommendation.placementAdvice.join(" ")).not.toContain("Ranger Bag footprint is unknown");
    expect(recommendation.layoutOptions[0].cells.length).toBeGreaterThan(0);
    expect(recommendation.layoutOptions[0].cells.every((cell) => cell.x >= 0 && cell.x <= 1 && cell.y >= 0 && cell.y <= 2)).toBe(true);
    expect(recommendation.layoutOptions[0].cells).toContainEqual(
      expect.objectContaining({ item: "Wooden Sword", width: 1, height: 2, shape: [[1], [1]] }),
    );
    expect(recommendation.layoutOptions[0].benchItems.map((item) => item.item)).toEqual(
      expect.arrayContaining(["Broom", "Banana"]),
    );
  });

  it("explains when known bag space was considered for placement", () => {
    const recommendation = recommendNextAction({
      gameState: baseState({
        round: 1,
        gold: 8,
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
        ],
        shopItems: [
          { name: "Stone", slot: "top-right", sale: false, price: 1 },
          { name: "Broom", slot: "bottom-center", sale: false, price: 4 },
        ],
      }),
      bpbCache,
      correctionPromptsUsed: [],
    });

    expect(recommendation.layoutConfidence).toBe("considered");
    expect(recommendation.placementAdvice.join(" ")).toContain("Known bag space was considered");
    expect(recommendation.layoutOptions[0].cells.every((cell) => cell.x <= 2 && cell.y <= 1)).toBe(true);
  });

  it("uses BPB cache shape instead of asking for bag shape confirmation", () => {
    const recommendation = recommendNextAction({
      gameState: baseState({
        round: 1,
        gold: 8,
        backpackItems: [
          { name: "Ranger Bag", location: "bag", itemKind: "bag", x: 0, y: 0 },
          { name: "Wooden Sword", location: "bag", x: 1, y: 1 },
        ],
        shopItems: [
          { name: "Stone", slot: "top-right", sale: false, price: 1 },
          { name: "Broom", slot: "bottom-center", sale: false, price: 4 },
        ],
      }),
      bpbCache,
      correctionPromptsUsed: [],
    });

    expect(recommendation.layoutConfidence).toBe("considered");
    expect(recommendation.layoutOptions.length).toBeGreaterThan(0);
    expect(recommendation.placementAdvice.join(" ")).not.toContain("Ranger Bag footprint is unknown");
  });

  it("asks for bag confirmation when cache shape data is unavailable", () => {
    const recommendation = recommendNextAction({
      gameState: baseState({
        round: 1,
        gold: 8,
        backpackItems: [
          { name: "Ranger Bag", location: "bag", itemKind: "bag", x: 0, y: 0 },
          { name: "Wooden Sword", location: "bag", x: 1, y: 1 },
        ],
        shopItems: [
          { name: "Stone", slot: "top-right", sale: false, price: 1 },
          { name: "Broom", slot: "bottom-center", sale: false, price: 4 },
        ],
      }),
      bpbCache: null,
      correctionPromptsUsed: [],
    });

    expect(recommendation.layoutConfidence).toBe("needs-confirmation");
    expect(recommendation.layoutOptions).toEqual([]);
    expect(recommendation.placementAdvice.join(" ")).toContain("Ranger Bag footprint is unknown");
  });

  it("does not recommend buying a sale item the player cannot afford", () => {
    const recommendation = recommendNextAction({
      gameState: baseState({
        gold: 1,
        shopItems: [{ name: "Broom", slot: "shop-1", sale: true, price: 3, groundedBpbId: 44 }],
      }),
      bpbCache,
      correctionPromptsUsed: [],
    });

    expect(recommendation.bestAction.type).not.toBe("buy");
    expect(recommendation.bestAction.target).not.toBe("Broom");
  });

  it("does not recommend buying a sale item when gold is unknown", () => {
    const recommendation = recommendNextAction({
      gameState: baseState({
        gold: null,
        shopItems: [{ name: "Broom", slot: "shop-1", sale: true, price: 3, groundedBpbId: 44 }],
      }),
      bpbCache,
      correctionPromptsUsed: [],
    });

    expect(recommendation.bestAction.type).not.toBe("buy");
  });

  it("does not recommend buying a sale item when the visible price is unknown", () => {
    const recommendation = recommendNextAction({
      gameState: baseState({
        shopItems: [{ name: "Broom", slot: "shop-1", sale: true, groundedBpbId: 44 }],
      }),
      bpbCache,
      correctionPromptsUsed: [],
    });

    expect(recommendation.bestAction.type).not.toBe("buy");
  });

  it("does not recommend buying ungrounded sale items", () => {
    const recommendation = recommendNextAction({
      gameState: baseState({
        shopItems: [{ name: "Mystery Blade", slot: "shop-1", sale: true, price: 1 }],
      }),
      bpbCache,
      correctionPromptsUsed: [],
    });

    expect(recommendation.bestAction.type).not.toBe("buy");
    expect(recommendation.assumptionsMade.some((text) => text.includes("Mystery Blade"))).toBe(true);
  });

  it("flags ungrounded item-specific advice as an assumption", () => {
    const recommendation = recommendNextAction({
      gameState: baseState({
        shopItems: [{ name: "Mystery Blade", slot: "shop-2", sale: false }],
      }),
      bpbCache,
      correctionPromptsUsed: [],
    });

    expect(recommendation.assumptionsMade.some((text) => text.includes("Mystery Blade"))).toBe(true);
  });

  it("treats cache items marked ungrounded as ungrounded", () => {
    const ungroundedCache: BpbCache = {
      ...bpbCache,
      items: bpbCache.items.map((item) => ({ ...item, grounded: false })),
    };

    const recommendation = recommendNextAction({
      gameState: baseState({
        shopItems: [{ name: "Broom", slot: "shop-1", sale: true, price: 1, groundedBpbId: 44 }],
      }),
      bpbCache: ungroundedCache,
      correctionPromptsUsed: [],
    });

    expect(recommendation.bestAction.type).not.toBe("buy");
    expect(recommendation.assumptionsMade.some((text) => text.includes("Broom"))).toBe(true);
    expect(recommendation.planSupported).not.toContain("Hero Sword");
  });

  it("keeps class plan advice generic when the cache is unavailable", () => {
    const recommendation = recommendNextAction({
      gameState: baseState({}),
      bpbCache: null,
      correctionPromptsUsed: [],
    });

    expect(recommendation.planSupported).not.toContain("Hero Sword");
    expect(recommendation.planSupported).not.toContain("Broom");
    expect(recommendation.planSupported).not.toContain("Whetstone");
    expect(recommendation.planSupported).toContain("Ranger");
  });

  it("keeps class plan advice generic when guide items are not all grounded", () => {
    const recommendation = recommendNextAction({
      gameState: baseState({}),
      bpbCache: { ...bpbCache, items: bpbCache.items.filter((item) => item.name === "Broom") },
      correctionPromptsUsed: [],
    });

    expect(recommendation.planSupported).not.toContain("Hero Sword");
    expect(recommendation.planSupported).not.toContain("Whetstone");
    expect(recommendation.planSupported).toContain("Ranger");
  });

  it("keeps class plan advice generic when required guide items are missing from the current state", () => {
    const recommendation = recommendNextAction({
      gameState: baseState({}),
      bpbCache,
      correctionPromptsUsed: [],
    });

    expect(recommendation.planSupported).not.toContain("Hero Sword");
    expect(recommendation.planSupported).not.toContain("Broom");
    expect(recommendation.planSupported).not.toContain("Whetstone");
    expect(recommendation.planSupported).toContain("Ranger");
  });

  it("uses specific class plan advice when required guide items are present and grounded", () => {
    const recommendation = recommendNextAction({
      gameState: baseState({
        backpackItems: [
          { name: "Hero Sword", location: "bag", groundedBpbId: 98 },
          { name: "Broom", location: "bag", groundedBpbId: 44 },
        ],
        storageItems: [{ name: "Whetstone", location: "storage", groundedBpbId: 51 }],
      }),
      bpbCache,
      correctionPromptsUsed: [],
    });

    expect(recommendation.planSupported).toContain("Hero Sword");
    expect(recommendation.planSupported).toContain("Broom");
    expect(recommendation.planSupported).toContain("Whetstone");
  });

  it("keeps non-Ranger class plans generic when guide items are not grounded", () => {
    const unrelatedCache: BpbCache = {
      ...bpbCache,
      items: bpbCache.items.filter((item) => item.name === "Broom"),
    };

    const reaperRecommendation = recommendNextAction({
      gameState: baseState({ className: "Reaper", backpackItems: [] }),
      bpbCache: unrelatedCache,
      correctionPromptsUsed: [],
    });
    const berserkerRecommendation = recommendNextAction({
      gameState: baseState({ className: "Berserker", backpackItems: [] }),
      bpbCache: unrelatedCache,
      correctionPromptsUsed: [],
    });
    const pyromancerRecommendation = recommendNextAction({
      gameState: baseState({ className: "Pyromancer", backpackItems: [] }),
      bpbCache: unrelatedCache,
      correctionPromptsUsed: [],
    });

    expect(reaperRecommendation.planSupported.toLowerCase()).not.toContain("cauldron");
    expect(reaperRecommendation.planSupported.toLowerCase()).not.toContain("staff");
    expect(berserkerRecommendation.planSupported.toLowerCase()).not.toContain("double");
    expect(berserkerRecommendation.planSupported.toLowerCase()).not.toContain("axe");
    expect(pyromancerRecommendation.planSupported).not.toContain("Burning Blade");
  });

  it("recommends rolling less when the round is too early for rare targets", () => {
    const recommendation = recommendNextAction({
      gameState: baseState({
        round: 2,
        gold: 2,
        shopItems: [],
      }),
      bpbCache,
      correctionPromptsUsed: [],
    });

    expect(recommendation.bestAction.type).toBe("start-battle");
    expect(recommendation.shortReason).toContain("tempo");
  });
});
