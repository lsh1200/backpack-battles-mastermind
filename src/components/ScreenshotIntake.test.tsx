import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { ValidationReport } from "@/lib/core/types";
import { ScreenshotIntake } from "./ScreenshotIntake";

const validation = {
  image: { width: 400, height: 225, orientation: "landscape" },
  regions: [
    {
      name: "inventoryGrid",
      x: 10,
      y: 24,
      width: 153,
      height: 119,
      columns: 9,
      rows: 7,
      cellWidth: 17,
      cellHeight: 17,
      source: "detected-grid",
    },
  ],
  warnings: [],
  requiresConfirmation: [],
} satisfies ValidationReport;

describe("ScreenshotIntake", () => {
  it("renders the detected inventory grid overlay on the screenshot preview", () => {
    const markup = renderToStaticMarkup(
      <ScreenshotIntake
        busy={false}
        mode="api"
        previewUrl="/screenshot.jpg"
        validation={validation}
        onAnalyze={vi.fn()}
        onFile={vi.fn()}
        onModeChange={vi.fn()}
      />,
    );

    expect(markup).toContain("screenshot-grid-overlay");
    expect(markup).toContain("--overlay-columns:9");
    expect(markup).toContain("--overlay-rows:7");
  });
});
