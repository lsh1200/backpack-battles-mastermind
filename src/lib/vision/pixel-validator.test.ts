import { readFile } from "node:fs/promises";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { ValidationReportSchema } from "@/lib/core/schemas";
import { validateScreenshotPixels } from "./pixel-validator";

describe("validateScreenshotPixels", () => {
  it("identifies landscape screenshots and coarse regions", async () => {
    const image = await sharp({
      create: {
        width: 2400,
        height: 1080,
        channels: 3,
        background: "#202020",
      },
    })
      .png()
      .toBuffer();

    const report = await validateScreenshotPixels(image);

    expect(() => ValidationReportSchema.parse(report)).not.toThrow();
    expect(report.image.orientation).toBe("landscape");
    expect(report.regions.map((region) => region.name)).toEqual(["shop", "backpack", "status", "inventoryGrid"]);
  });

  it("uses auto-oriented metadata for rotated phone screenshots", async () => {
    const image = await sharp({
      create: {
        width: 1080,
        height: 2400,
        channels: 3,
        background: "#202020",
      },
    })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();

    const report = await validateScreenshotPixels(image);

    expect(report.image.width).toBe(2400);
    expect(report.image.height).toBe(1080);
    expect(report.image.orientation).toBe("landscape");
    expect(report.requiresConfirmation).not.toContain("orientation");
    expect(report.regions[0]?.width).toBeCloseTo(816);
  });

  it("detects the 9x7 inventory grid geometry from screenshot pixels", async () => {
    const cell = 20;
    const left = 18;
    const top = 28;
    const base = sharp({
      create: {
        width: 420,
        height: 240,
        channels: 3,
        background: "#76624a",
      },
    });
    const cells = Array.from({ length: 7 }).flatMap((_, y) =>
      Array.from({ length: 9 }).map((__, x) => ({
        input: {
          create: {
            width: cell - 2,
            height: cell - 2,
            channels: 3 as const,
            background: "#c8ab79",
          },
        },
        left: left + x * cell + 1,
        top: top + y * cell + 1,
      })),
    );
    const image = await base.composite(cells).png().toBuffer();

    const report = await validateScreenshotPixels(image);
    const grid = report.regions.find((region) => region.name === "inventoryGrid");

    expect(grid).toEqual(
      expect.objectContaining({
        columns: 9,
        rows: 7,
        source: "detected-grid",
      }),
    );
    expect(grid?.x).toBeCloseTo(left, -1);
    expect(grid?.y).toBeCloseTo(top, -1);
    expect(grid?.cellWidth).toBeCloseTo(cell, 0);
  });

  it("matches the saved in-game inventory grid guide", async () => {
    const image = await readFile("data/grid-guides/round1-inventory-grid-guide.png");

    const report = await validateScreenshotPixels(image);
    const grid = report.regions.find((region) => region.name === "inventoryGrid");

    expect(grid).toEqual(
      expect.objectContaining({
        columns: 9,
        rows: 7,
        source: "detected-grid",
      }),
    );
    expect(grid?.x).toBeCloseTo(8, 0);
    expect(grid?.y).toBeCloseTo(10, 0);
    expect(grid?.cellWidth).toBeCloseTo(14, 0);
  });

  it("asks for a clearer screenshot when the image is too small", async () => {
    const image = await sharp({
      create: {
        width: 300,
        height: 200,
        channels: 3,
        background: "#202020",
      },
    })
      .png()
      .toBuffer();

    const report = await validateScreenshotPixels(image);

    expect(report.requiresConfirmation).toContain("screenshotQuality");
  });

  it("asks for confirmation when the displayed screenshot is not landscape", async () => {
    const image = await sharp({
      create: {
        width: 1080,
        height: 2400,
        channels: 3,
        background: "#202020",
      },
    })
      .png()
      .toBuffer();

    const report = await validateScreenshotPixels(image);

    expect(report.image.orientation).toBe("portrait");
    expect(report.requiresConfirmation).toContain("orientation");
  });
});
