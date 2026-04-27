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
    expect(report.regions.map((region) => region.name)).toEqual(["shop", "backpack", "status"]);
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
