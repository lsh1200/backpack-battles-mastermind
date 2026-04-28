import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { AnalysisResult } from "@/lib/core/types";
import { CorrectionPanel } from "./CorrectionPanel";

const result = {
  gameState: {
    round: 1,
    gold: 13,
    lives: 5,
    wins: 0,
    className: "Ranger",
    bagChoice: "Ranger Bag",
    skills: [],
    subclass: null,
    shopItems: [{ name: "Stone", slot: "top-right", sale: false, price: 1 }],
    backpackItems: [],
    storageItems: [],
    userGoal: "learn",
    uncertainFields: ["shopItems.0.name"],
  },
  validation: {
    image: { width: 1280, height: 591, orientation: "landscape" },
    regions: [],
    warnings: [],
    requiresConfirmation: [],
  },
  correctionQuestions: [
    {
      field: "shopItems.0.name",
      question: "What is this item actually?",
      context: "Shop top-right",
      currentValue: "Stone",
      imageUrl: "/api/codex-handoff?id=abc&asset=crop&field=shopItems.0.name",
      options: ["Stone", "Banana", "Broom"],
    },
  ],
  recommendation: null,
} satisfies AnalysisResult;

describe("CorrectionPanel", () => {
  it("renders item crops and a one-click correct button", () => {
    const markup = renderToStaticMarkup(
      <CorrectionPanel result={result} corrections={{}} setCorrections={vi.fn()} onSubmit={vi.fn()} />,
    );

    expect(markup).toContain("What is this item actually?");
    expect(markup).toContain("Shop top-right");
    expect(markup).toContain("Current read: <strong>Stone</strong>");
    expect(markup).toContain('src="/api/codex-handoff?id=abc&amp;asset=crop&amp;field=shopItems.0.name"');
    expect(markup).toContain(">Correct</button>");
  });
});
