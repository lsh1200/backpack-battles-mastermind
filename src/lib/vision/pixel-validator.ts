import sharp from "sharp";
import type { ValidationReport } from "@/lib/core/types";

export async function validateScreenshotPixels(image: Buffer): Promise<ValidationReport> {
  const metadata = await sharp(image).metadata();
  const width = metadata.autoOrient?.width ?? metadata.width ?? 0;
  const height = metadata.autoOrient?.height ?? metadata.height ?? 0;
  const orientation = width === height ? "square" : width > height ? "landscape" : "portrait";
  const warnings: string[] = [];
  const requiresConfirmation: string[] = [];

  if (width < 1000 || height < 600) {
    warnings.push("Screenshot is small; item text and icons may be hard to read.");
    requiresConfirmation.push("screenshotQuality");
  }

  if (orientation !== "landscape") {
    warnings.push("Expected a landscape Backpack Battles shop screenshot.");
    requiresConfirmation.push("orientation");
  }

  const regions = [
    { name: "shop", x: width * 0.02, y: height * 0.08, width: width * 0.34, height: height * 0.72 },
    { name: "backpack", x: width * 0.38, y: height * 0.08, width: width * 0.42, height: height * 0.82 },
    { name: "status", x: width * 0.8, y: height * 0.02, width: width * 0.18, height: height * 0.18 },
  ];

  return {
    image: { width, height, orientation },
    regions,
    warnings,
    requiresConfirmation,
  };
}
