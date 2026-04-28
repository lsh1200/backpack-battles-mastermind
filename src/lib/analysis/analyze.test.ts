import { describe, expect, it } from "vitest";
import type { BpbCache } from "@/lib/bpb/schemas";
import type { GameState, ValidationReport } from "@/lib/core/types";
import { AnalysisResultSchema } from "@/lib/core/schemas";
import { analyzeCorrectedState } from "./analyze";

const cache: BpbCache = {
  fetchedAt: "2026-04-27T00:00:00.000Z",
  patchVersion: "1.1.1",
  patchDate: "2026-04-03T08:01:07.000Z",
  sourceUrls: ["https://bpb-builds.vercel.app/items"],
  items: [
    {
      id: 44,
      name: "Broom",
      aliases: ["broom"],
      imageUrl: "https://awerc.github.io/bpb-cdn/i/Broom.webp",
      grounded: true,
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
    {
      id: 999,
      name: "Mystery Blade",
      aliases: ["mystery blade"],
      grounded: false,
      tags: [],
    },
  ],
  builds: [],
};

const validation: ValidationReport = {
  image: { width: 2400, height: 1080, orientation: "landscape" },
  regions: [],
  warnings: [],
  requiresConfirmation: [],
};

function baseGameState(overrides: Partial<GameState>): GameState {
  return {
    round: 3,
    gold: 6,
    lives: 5,
    wins: 1,
    className: "Ranger",
    bagChoice: null,
    skills: [],
    subclass: null,
    shopItems: [],
    backpackItems: [],
    storageItems: [],
    userGoal: "learn",
    uncertainFields: [],
    ...overrides,
  };
}

describe("analysis orchestrator", () => {
  it("returns correction questions before recommendation when fields are uncertain", async () => {
    const result = await analyzeCorrectedState({
      gameState: baseGameState({
        className: "Unknown",
        shopItems: [{ name: "Brom", slot: "shop-1", sale: false }],
        uncertainFields: ["className", "shopItems.0.name"],
      }),
      validation,
      bpbCache: cache,
      correctionPromptsUsed: [],
    });

    expect(result.recommendation).toBeNull();
    expect(result.correctionQuestions.length).toBeGreaterThan(0);
    expect(result.correctionQuestions.find((question) => question.field === "shopItems.0.name")?.options).not.toContain(
      "Mystery Blade",
    );
    expect(() => AnalysisResultSchema.parse(result)).not.toThrow();
  });

  it("grounds recognized items and returns a recommendation when there are no correction questions", async () => {
    const result = await analyzeCorrectedState({
      gameState: baseGameState({
        shopItems: [{ name: "Broom", slot: "shop-1", sale: true, price: 3 }],
        backpackItems: [{ name: "Hero Sword", location: "bag" }],
        storageItems: [{ name: "Mystery Blade", location: "storage" }],
      }),
      validation,
      bpbCache: cache,
      correctionPromptsUsed: ["className"],
    });

    expect(result.correctionQuestions).toEqual([]);
    expect(result.gameState.shopItems[0]?.groundedBpbId).toBe(44);
    expect(result.gameState.backpackItems[0]?.groundedBpbId).toBe(98);
    expect(result.gameState.storageItems[0]?.groundedBpbId).toBeUndefined();
    expect(result.recommendation?.bestAction.type).toBe("buy");
    expect(result.recommendation?.correctionPromptsUsed).toEqual(["className"]);
    expect(() => AnalysisResultSchema.parse(result)).not.toThrow();
  });

  it("passes recognition provenance into the recommendation", async () => {
    const result = await analyzeCorrectedState({
      gameState: baseGameState({
        shopItems: [{ name: "Broom", slot: "shop-1", sale: true, price: 3 }],
        backpackItems: [{ name: "Hero Sword", location: "bag" }],
      }),
      validation,
      bpbCache: cache,
      correctionPromptsUsed: ["codex-test-mode"],
      itemRecognitionSource: "llm-fallback",
    });

    expect(result.recommendation?.recognitionPolicy.itemRecognition).toBe("llm-fallback");
    expect(result.recommendation?.recognitionPolicy.summary).toContain("LLM fallback");
  });
});
