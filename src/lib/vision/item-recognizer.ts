import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import type { BpbCache, BpbItem } from "@/lib/bpb/schemas";
import type { BackpackItem, GameState, Recommendation, ShopItem } from "@/lib/core/types";

type RecognitionSource = Recommendation["recognitionPolicy"]["itemRecognition"];

type Crop = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type ScreenSlot = {
  slot: string;
  crop: Crop;
  x?: number;
  y?: number;
};

export type RecognitionScreenProfile = {
  shopSlots: ScreenSlot[];
  backpackSlots: ScreenSlot[];
};

export type RecognitionCandidate = {
  name: string;
  bpbId: number;
  score: number;
};

export type RecognitionMatch = {
  region: "shop" | "backpack";
  slot: string;
  field: string;
  crop: Crop;
  accepted: boolean;
  candidates: RecognitionCandidate[];
};

export type ItemRecognitionReport = {
  source: RecognitionSource;
  shopItems: ShopItem[];
  backpackItems: BackpackItem[];
  uncertainFields: string[];
  warnings: string[];
  candidateOptionsByField: Record<string, string[]>;
  matches: RecognitionMatch[];
};

type ImageFeature = {
  pixels: Uint8Array;
  average: [number, number, number];
};

type TemplateFeature = {
  item: BpbItem;
  feature: ImageFeature;
};

type RecognizeItemsInput = {
  image: Buffer;
  bpbCache: BpbCache | null;
  profile?: RecognitionScreenProfile;
  highConfidenceThreshold?: number;
  minCandidateGap?: number;
  maxTemplates?: number;
};

const FEATURE_SIZE = 32;
const UNKNOWN_ITEM = "Unknown Item";
const DEFAULT_HIGH_CONFIDENCE_THRESHOLD = 0.82;
const DEFAULT_MIN_CANDIDATE_GAP = 0.035;
const DEFAULT_MAX_TEMPLATES = 64;
const templateCache = new Map<string, Promise<ImageFeature>>();

function clampCrop(crop: Crop, width: number, height: number): Crop | null {
  const x = Math.max(0, Math.round(crop.x));
  const y = Math.max(0, Math.round(crop.y));
  const right = Math.min(width, Math.round(crop.x + crop.width));
  const bottom = Math.min(height, Math.round(crop.y + crop.height));
  const croppedWidth = right - x;
  const croppedHeight = bottom - y;

  return croppedWidth > 1 && croppedHeight > 1 ? { x, y, width: croppedWidth, height: croppedHeight } : null;
}

function roundScore(score: number): number {
  return Math.round(score * 1000) / 1000;
}

function defaultScreenProfile(width: number, height: number): RecognitionScreenProfile {
  const crop = (x: number, y: number, w: number, h: number): Crop => ({
    x: x * width,
    y: y * height,
    width: w * width,
    height: h * height,
  });

  return {
    shopSlots: [
      { slot: "top-right", crop: crop(0.66, 0.14, 0.11, 0.14) },
      { slot: "middle-left", crop: crop(0.53, 0.32, 0.13, 0.18) },
      { slot: "middle-right", crop: crop(0.70, 0.31, 0.13, 0.18) },
      { slot: "bottom-left", crop: crop(0.51, 0.52, 0.14, 0.22) },
      { slot: "bottom-right", crop: crop(0.70, 0.52, 0.14, 0.22) },
    ],
    backpackSlots: [
      { slot: "bag-main", crop: crop(0.13, 0.15, 0.18, 0.23), x: 0, y: 0 },
      { slot: "bag-left", crop: crop(0.15, 0.22, 0.07, 0.18), x: 0, y: 1 },
      { slot: "bag-center", crop: crop(0.21, 0.20, 0.07, 0.22), x: 1, y: 1 },
      { slot: "bag-right", crop: crop(0.26, 0.23, 0.07, 0.18), x: 2, y: 1 },
    ],
  };
}

function decodeDataUrl(dataUrl: string): Buffer | null {
  const match = dataUrl.match(/^data:[^;]+;base64,(.+)$/i);
  return match ? Buffer.from(match[1], "base64") : null;
}

async function readImageSource(source: string): Promise<Buffer> {
  const dataUrl = decodeDataUrl(source);
  if (dataUrl) {
    return dataUrl;
  }

  if (source.startsWith("file:")) {
    return readFile(fileURLToPath(source));
  }

  if (source.startsWith("http://") || source.startsWith("https://")) {
    const response = await fetch(source);
    if (!response.ok) {
      throw new Error(`Failed to fetch BPB item icon ${source}: ${response.status}`);
    }

    return Buffer.from(await response.arrayBuffer());
  }

  return readFile(source);
}

async function featureFromBuffer(image: Buffer): Promise<ImageFeature> {
  const { data } = await sharp(image)
    .rotate()
    .resize(FEATURE_SIZE, FEATURE_SIZE, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  let red = 0;
  let green = 0;
  let blue = 0;
  const pixels = new Uint8Array(data);

  for (let index = 0; index < pixels.length; index += 3) {
    red += pixels[index] ?? 0;
    green += pixels[index + 1] ?? 0;
    blue += pixels[index + 2] ?? 0;
  }

  const pixelCount = pixels.length / 3;

  return {
    pixels,
    average: [red / pixelCount, green / pixelCount, blue / pixelCount],
  };
}

async function templateFeature(item: BpbItem): Promise<TemplateFeature | null> {
  if (!item.imageUrl) {
    return null;
  }

  try {
    const featurePromise = templateCache.get(item.imageUrl) ?? featureFromBuffer(await readImageSource(item.imageUrl));
    templateCache.set(item.imageUrl, featurePromise);

    return {
      item,
      feature: await featurePromise,
    };
  } catch {
    return null;
  }
}

async function extractCropFeature(image: Buffer, crop: Crop): Promise<ImageFeature> {
  const extracted = await sharp(image)
    .rotate()
    .extract({ left: crop.x, top: crop.y, width: crop.width, height: crop.height })
    .png()
    .toBuffer();
  return featureFromBuffer(extracted);
}

function compareFeatures(left: ImageFeature, right: ImageFeature): number {
  let pixelDifference = 0;
  const length = Math.min(left.pixels.length, right.pixels.length);

  for (let index = 0; index < length; index += 1) {
    pixelDifference += Math.abs((left.pixels[index] ?? 0) - (right.pixels[index] ?? 0));
  }

  const pixelScore = 1 - Math.min(1, pixelDifference / (length * 255));
  const averageDifference =
    Math.abs(left.average[0] - right.average[0]) +
    Math.abs(left.average[1] - right.average[1]) +
    Math.abs(left.average[2] - right.average[2]);
  const averageScore = 1 - Math.min(1, averageDifference / (3 * 255));

  return roundScore(pixelScore * 0.75 + averageScore * 0.25);
}

function rankedCandidates(cropFeature: ImageFeature, templates: TemplateFeature[]): RecognitionCandidate[] {
  return templates
    .map((template) => ({
      name: template.item.name,
      bpbId: template.item.id,
      score: compareFeatures(cropFeature, template.feature),
    }))
    .sort((left, right) => right.score - left.score)
    .slice(0, 3);
}

function candidateNames(candidates: RecognitionCandidate[]): string[] {
  return candidates.map((candidate) => candidate.name);
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values));
}

function recognitionSource(matches: RecognitionMatch[], warnings: string[]): RecognitionSource {
  if (matches.length === 0) {
    return "llm-fallback";
  }

  if (warnings.length > 0 || matches.some((match) => !match.accepted)) {
    return "mixed";
  }

  return "local-first";
}

async function buildTemplates(cache: BpbCache, maxTemplates: number): Promise<TemplateFeature[]> {
  const groundedItems = cache.items.filter((item) => item.grounded && item.imageUrl).slice(0, maxTemplates);
  const templates = await Promise.all(groundedItems.map(templateFeature));
  return templates.filter((template): template is TemplateFeature => template !== null);
}

async function recognizeSlots(input: {
  image: Buffer;
  imageWidth: number;
  imageHeight: number;
  slots: ScreenSlot[];
  region: "shop" | "backpack";
  templates: TemplateFeature[];
  threshold: number;
  minCandidateGap: number;
}): Promise<{
  items: Array<ShopItem | BackpackItem>;
  uncertainFields: string[];
  warnings: string[];
  candidateOptionsByField: Record<string, string[]>;
  matches: RecognitionMatch[];
}> {
  const items: Array<ShopItem | BackpackItem> = [];
  const uncertainFields: string[] = [];
  const warnings: string[] = [];
  const candidateOptionsByField: Record<string, string[]> = {};
  const matches: RecognitionMatch[] = [];

  for (const slot of input.slots) {
    const crop = clampCrop(slot.crop, input.imageWidth, input.imageHeight);
    if (crop === null) {
      continue;
    }

    const field = `${input.region === "shop" ? "shopItems" : "backpackItems"}.${items.length}.name`;
    const cropFeature = await extractCropFeature(input.image, crop);
    const candidates = rankedCandidates(cropFeature, input.templates);
    const best = candidates[0];
    const runnerUp = candidates[1];
    const candidateGap = best && runnerUp ? best.score - runnerUp.score : best?.score ?? 0;
    const accepted = best !== undefined && best.score >= input.threshold && candidateGap >= input.minCandidateGap;

    matches.push({
      region: input.region,
      slot: slot.slot,
      field,
      crop,
      accepted,
      candidates,
    });

    if (!accepted) {
      const warning = `${slot.slot} local template confidence is low; confirm this item before using item-specific advice.`;
      warnings.push(warning);
      uncertainFields.push(field);
      candidateOptionsByField[field] = candidateNames(candidates);

      items.push(
        input.region === "shop"
          ? { name: UNKNOWN_ITEM, slot: slot.slot, sale: false }
          : { name: UNKNOWN_ITEM, location: "bag", ...(slot.x !== undefined ? { x: slot.x } : {}), ...(slot.y !== undefined ? { y: slot.y } : {}) },
      );
      continue;
    }

    items.push(
      input.region === "shop"
        ? { name: best.name, slot: slot.slot, sale: false, groundedBpbId: best.bpbId }
        : {
            name: best.name,
            location: "bag",
            groundedBpbId: best.bpbId,
            ...(slot.x !== undefined ? { x: slot.x } : {}),
            ...(slot.y !== undefined ? { y: slot.y } : {}),
          },
    );
  }

  return {
    items,
    uncertainFields,
    warnings,
    candidateOptionsByField,
    matches,
  };
}

export async function recognizeItemsFromScreenshot(input: RecognizeItemsInput): Promise<ItemRecognitionReport> {
  if (input.bpbCache === null) {
    return {
      source: "llm-fallback",
      shopItems: [],
      backpackItems: [],
      uncertainFields: [],
      warnings: ["BPB cache is missing, so deterministic item recognition could not run."],
      candidateOptionsByField: {},
      matches: [],
    };
  }

  const metadata = await sharp(input.image).rotate().metadata();
  const imageWidth = metadata.width ?? 0;
  const imageHeight = metadata.height ?? 0;
  const templates = await buildTemplates(input.bpbCache, input.maxTemplates ?? DEFAULT_MAX_TEMPLATES);

  if (templates.length === 0) {
    return {
      source: "llm-fallback",
      shopItems: [],
      backpackItems: [],
      uncertainFields: [],
      warnings: ["No grounded BPB item icon templates were available for deterministic recognition."],
      candidateOptionsByField: {},
      matches: [],
    };
  }

  const profile = input.profile ?? defaultScreenProfile(imageWidth, imageHeight);
  const threshold = input.highConfidenceThreshold ?? DEFAULT_HIGH_CONFIDENCE_THRESHOLD;
  const minCandidateGap = input.minCandidateGap ?? DEFAULT_MIN_CANDIDATE_GAP;
  const [shop, backpack] = await Promise.all([
    recognizeSlots({
      image: input.image,
      imageWidth,
      imageHeight,
      slots: profile.shopSlots,
      region: "shop",
      templates,
      threshold,
      minCandidateGap,
    }),
    recognizeSlots({
      image: input.image,
      imageWidth,
      imageHeight,
      slots: profile.backpackSlots,
      region: "backpack",
      templates,
      threshold,
      minCandidateGap,
    }),
  ]);
  const warnings = [...shop.warnings, ...backpack.warnings];
  const matches = [...shop.matches, ...backpack.matches];

  return {
    source: recognitionSource(matches, warnings),
    shopItems: shop.items as ShopItem[],
    backpackItems: backpack.items as BackpackItem[],
    uncertainFields: uniqueStrings([...shop.uncertainFields, ...backpack.uncertainFields]),
    warnings,
    candidateOptionsByField: { ...shop.candidateOptionsByField, ...backpack.candidateOptionsByField },
    matches,
  };
}

function mergeShopItems(visionItems: ShopItem[], recognizedItems: ShopItem[]): ShopItem[] {
  if (recognizedItems.length === 0) {
    return visionItems;
  }

  return recognizedItems.map((recognized, index) => {
    const visionItem = visionItems.find((item) => item.slot === recognized.slot) ?? visionItems[index];

    return {
      ...recognized,
      sale: visionItem?.sale ?? recognized.sale,
      ...(visionItem?.price !== undefined ? { price: visionItem.price } : {}),
    };
  });
}

function mergeBackpackItems(visionItems: BackpackItem[], recognizedItems: BackpackItem[]): BackpackItem[] {
  if (recognizedItems.length === 0) {
    return visionItems;
  }

  return recognizedItems.map((recognized, index) => {
    const visionItem = visionItems[index];

    return {
      ...recognized,
      location: visionItem?.location ?? recognized.location,
      ...(visionItem?.x !== undefined && recognized.x === undefined ? { x: visionItem.x } : {}),
      ...(visionItem?.y !== undefined && recognized.y === undefined ? { y: visionItem.y } : {}),
    };
  });
}

export function applyItemRecognitionToGameState(gameState: GameState, report: ItemRecognitionReport | null): GameState {
  if (report === null || report.matches.length === 0) {
    return gameState;
  }

  const recognizedFields = new Set(report.matches.filter((match) => match.accepted).map((match) => match.field));

  return {
    ...gameState,
    shopItems: mergeShopItems(gameState.shopItems, report.shopItems),
    backpackItems: mergeBackpackItems(gameState.backpackItems, report.backpackItems),
    uncertainFields: uniqueStrings([
      ...gameState.uncertainFields.filter((field) => !recognizedFields.has(field)),
      ...report.uncertainFields,
    ]),
  };
}
