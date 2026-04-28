import sharp from "sharp";
import type { ValidationReport } from "@/lib/core/types";

const BPB_GRID_COLUMNS = 9;
const BPB_GRID_ROWS = 7;
const DETECTION_WIDTH = 640;

type ImagePlane = {
  data: Uint8Array;
  width: number;
  height: number;
};

function luminanceAt(plane: ImagePlane, x: number, y: number): number {
  const clampedX = Math.max(0, Math.min(plane.width - 1, Math.round(x)));
  const clampedY = Math.max(0, Math.min(plane.height - 1, Math.round(y)));
  const index = (clampedY * plane.width + clampedX) * 3;
  return 0.299 * (plane.data[index] ?? 0) + 0.587 * (plane.data[index + 1] ?? 0) + 0.114 * (plane.data[index + 2] ?? 0);
}

function lineContrast(plane: ImagePlane, x: number, y: number, length: number, vertical: boolean): number {
  const samples = 14;
  let score = 0;

  for (let index = 0; index < samples; index += 1) {
    const offset = (index + 0.5) * (length / samples);
    const sampleX = vertical ? x : x + offset;
    const sampleY = vertical ? y + offset : y;
    const center = luminanceAt(plane, sampleX, sampleY);
    const before = luminanceAt(plane, vertical ? sampleX - 2 : sampleX, vertical ? sampleY : sampleY - 2);
    const after = luminanceAt(plane, vertical ? sampleX + 2 : sampleX, vertical ? sampleY : sampleY + 2);
    score += Math.max(0, (before + after) / 2 - center);
  }

  return score / samples;
}

function gridScore(plane: ImagePlane, x: number, y: number, cellSize: number): number {
  let score = 0;

  for (let column = 0; column <= BPB_GRID_COLUMNS; column += 1) {
    score += lineContrast(plane, x + column * cellSize, y, BPB_GRID_ROWS * cellSize, true);
  }

  for (let row = 0; row <= BPB_GRID_ROWS; row += 1) {
    score += lineContrast(plane, x, y + row * cellSize, BPB_GRID_COLUMNS * cellSize, false);
  }

  return score;
}

async function detectInventoryGrid(image: Buffer, width: number, height: number): Promise<ValidationReport["regions"][number]> {
  const scale = Math.min(1, DETECTION_WIDTH / width);
  const detectionWidth = Math.max(1, Math.round(width * scale));
  const detectionHeight = Math.max(1, Math.round(height * scale));
  const { data, info } = await sharp(image)
    .rotate()
    .resize(detectionWidth, detectionHeight, { fit: "fill" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const plane = { data: new Uint8Array(data), width: info.width, height: info.height };
  const minCell = Math.max(10, Math.round(plane.height * 0.052));
  const maxCell = Math.max(minCell, Math.round(plane.height * 0.088));
  let best = {
    score: -1,
    x: Math.round(plane.width * 0.02),
    y: Math.round(plane.height * 0.11),
    cellSize: Math.round(plane.height * 0.075),
  };

  for (let cellSize = minCell; cellSize <= maxCell; cellSize += 1) {
    const maxX = Math.min(Math.round(plane.width * 0.34), plane.width - BPB_GRID_COLUMNS * cellSize - 1);
    const minY = Math.round(plane.height * 0.05);
    const maxY = Math.min(Math.round(plane.height * 0.22), plane.height - BPB_GRID_ROWS * cellSize - 1);
    for (let y = minY; y <= maxY; y += 2) {
      for (let x = 0; x <= maxX; x += 2) {
        const score = gridScore(plane, x, y, cellSize);
        if (score > best.score) {
          best = { score, x, y, cellSize };
        }
      }
    }
  }

  const inverseScale = 1 / scale;
  const cellWidth = best.cellSize * inverseScale;
  const cellHeight = best.cellSize * inverseScale;

  return {
    name: "inventoryGrid",
    x: best.x * inverseScale,
    y: best.y * inverseScale,
    width: BPB_GRID_COLUMNS * cellWidth,
    height: BPB_GRID_ROWS * cellHeight,
    columns: BPB_GRID_COLUMNS,
    rows: BPB_GRID_ROWS,
    cellWidth,
    cellHeight,
    source: "detected-grid",
  };
}

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

  const inventoryGrid = orientation === "landscape" ? await detectInventoryGrid(image, width, height) : null;
  const regions = [
    { name: "shop", x: width * 0.02, y: height * 0.08, width: width * 0.34, height: height * 0.72 },
    { name: "backpack", x: width * 0.38, y: height * 0.08, width: width * 0.42, height: height * 0.82 },
    { name: "status", x: width * 0.8, y: height * 0.02, width: width * 0.18, height: height * 0.18 },
    ...(inventoryGrid ? [inventoryGrid] : []),
  ];

  return {
    image: { width, height, orientation },
    regions,
    warnings,
    requiresConfirmation,
  };
}
