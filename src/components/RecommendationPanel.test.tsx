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
  });
});
