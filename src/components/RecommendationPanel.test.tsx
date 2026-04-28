import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Recommendation } from "@/lib/core/types";
import { RecommendationPanel } from "./RecommendationPanel";

const recommendation = {
  bestAction: {
    type: "buy",
    target: "Broom, Banana, Stone",
    value: 95,
    risks: [],
    assumptions: [],
    teachingReason: "Buy the early package.",
  },
  shortReason: "Buy the early shopping sequence.",
  rejectedAlternatives: [],
  planSupported: "Ranger wants weapon tempo.",
  placementAdvice: [
    "Keep Wooden Sword active and place Broom as the second weapon, not in storage.",
    "Put Stone adjacent to Wooden Sword or Broom so it contributes damage immediately.",
  ],
  layoutConfidence: "considered",
  recognitionPolicy: {
    itemRecognition: "local-first",
    summary: "Item names are grounded against local BPB data before recommendation.",
    warnings: [],
  },
  layoutOptions: [
    {
      id: "tempo-weapons",
      title: "Tempo Weapons",
      score: 92,
      summary: "Prioritizes two active weapons.",
      moves: ["Keep Wooden Sword at (1, 1).", "Place Broom at (2, 1) as your second active weapon."],
      tradeoffs: ["Less flexible utility space."],
      cells: [
        { item: "Wooden Sword", x: 1, y: 1, width: 1, height: 2, shape: [[1], [1]], role: "primary weapon" },
        { item: "Stone", x: 0, y: 0, width: 1, height: 1, shape: [[1]], role: "weapon damage adjacency" },
      ],
      benchItems: [
        {
          item: "Broom",
          reason: "Keep in storage for now; it does not fit in the known active bag space.",
          shape: [[0, 1], [0, 1], [0, 1], [0, 1]],
        },
      ],
    },
    {
      id: "stamina-safe",
      title: "Stamina Safe",
      score: 86,
      summary: "Keeps Banana safer.",
      moves: ["Place Banana at (0, 2)."],
      tradeoffs: ["Slightly less weapon adjacency."],
      cells: [{ item: "Banana", x: 0, y: 2, width: 1, height: 1, role: "stamina support" }],
      benchItems: [],
    },
  ],
  nextTargets: ["Start battle after arranging the board."],
  assumptionsMade: [],
  correctionPromptsUsed: [],
} satisfies Recommendation;

describe("RecommendationPanel", () => {
  it("renders placement guidance as its own coaching section", () => {
    const markup = renderToStaticMarkup(<RecommendationPanel recommendation={recommendation} />);

    expect(markup).toContain("<h3>Placement</h3>");
    expect(markup).toContain("Keep Wooden Sword active and place Broom as the second weapon, not in storage.");
    expect(markup).toContain("Put Stone adjacent to Wooden Sword or Broom so it contributes damage immediately.");
    expect(markup).toContain("<h3>Layout Confidence</h3>");
    expect(markup).toContain("Considered");
    expect(markup).toContain("Tempo Weapons");
    expect(markup).toContain("Stamina Safe");
    expect(markup).toContain("Wooden Sword");
    expect(markup).toContain("Broom");
    expect(markup).toContain("Storage for now");
    expect(markup).toContain("Broom footprint");
    expect(markup).toContain("Item Recognition");
    expect(markup).toContain("local-first");
  });

  it("renders bag-space confidence text when placement needs confirmation", () => {
    const markup = renderToStaticMarkup(
      <RecommendationPanel
        recommendation={{
          ...recommendation,
          layoutConfidence: "needs-confirmation",
          placementAdvice: ["Confirm bag placement and bag shape before treating layout moves as exact."],
          layoutOptions: [],
        }}
      />,
    );

    expect(markup).toContain("Needs Confirmation");
    expect(markup).toContain("Confirm bag placement and bag shape before treating layout moves as exact.");
  });
});
