import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import type { BpbCache, BpbItem } from "@/lib/bpb/schemas";
import { GameStateSchema } from "@/lib/core/schemas";
import type { GameState, ValidationReport } from "@/lib/core/types";
import type { ItemRecognitionReport } from "@/lib/vision/item-recognizer";
import {
  CodexHandoffResultSchema,
  CodexHandoffSchema,
  CodexItemRecognitionReportSchema,
  type CodexHandoffItem,
} from "./schemas";

export const DEFAULT_CODEX_HANDOFF_DIR = "data/codex-handoffs";

type CreateCodexHandoffInput = {
  baseDir?: string;
  bpbCache: BpbCache | null;
  image: Buffer;
  mimeType: string;
  validation: ValidationReport;
  itemRecognitionReport?: ItemRecognitionReport | null;
};

type CreatedCodexHandoff = {
  id: string;
  status: "pending";
  screenshotPath: string;
  promptPath: string;
  resultPath: string;
  prompt: string;
  relevantItems: CodexHandoffItem[];
};

type CodexHandoffResult =
  | {
      status: "pending";
    }
  | {
      status: "complete";
      gameState: GameState;
    };

function handoffBaseDir(baseDir = process.env.CODEX_HANDOFF_DIR ?? DEFAULT_CODEX_HANDOFF_DIR): string {
  return resolve(baseDir);
}

function safeMimeExtension(mimeType: string): string {
  if (mimeType === "image/jpeg") {
    return "jpg";
  }

  if (mimeType === "image/webp") {
    return "webp";
  }

  return "png";
}

function compactItem(item: BpbItem): CodexHandoffItem {
  return {
    id: item.id,
    name: item.name,
    ...(item.className !== undefined ? { className: item.className } : {}),
    ...(item.rarity !== undefined ? { rarity: item.rarity } : {}),
    ...(item.type !== undefined ? { type: item.type } : {}),
    ...(item.cost !== undefined ? { cost: item.cost } : {}),
    tags: item.tags,
    ...(item.effectText !== undefined ? { effectText: item.effectText } : {}),
  };
}

function relevantItems(bpbCache: BpbCache | null): CodexHandoffItem[] {
  return bpbCache?.items.filter((item) => item.grounded).slice(0, 120).map(compactItem) ?? [];
}

function buildPrompt(input: {
  resultPath: string;
  screenshotPath: string;
  validation: ValidationReport;
  relevantItems: CodexHandoffItem[];
  itemRecognitionReport?: ItemRecognitionReport | null;
}): string {
  const recognitionContext = input.itemRecognitionReport
    ? [
        "Deterministic local recognition candidates:",
        JSON.stringify(
          {
            source: input.itemRecognitionReport.source,
            shopItems: input.itemRecognitionReport.shopItems,
            backpackItems: input.itemRecognitionReport.backpackItems,
            uncertainFields: input.itemRecognitionReport.uncertainFields,
            candidateOptionsByField: input.itemRecognitionReport.candidateOptionsByField,
            warnings: input.itemRecognitionReport.warnings,
          },
          null,
          2,
        ),
        "Do not replace high-confidence deterministic item names. Use Codex only to audit coarse screen fields, sale/price metadata, and fields already marked uncertain.",
      ]
    : ["Deterministic local recognition candidates: none were provided."];

  return [
    "# Backpack Battles Codex Test Handoff",
    "",
    "Use view_image on this screenshot:",
    input.screenshotPath,
    "",
    "This Codex handoff is an LLM fallback/audit path, not the primary item recognizer.",
    "Audit the Backpack Battles Android screenshot and produce only a GameState JSON object.",
    "Do not identify item names by raw visual guessing. The local BPB item list and user corrections are the authority for item identity.",
    "If a sprite cannot be matched to a grounded local item, use Unknown Item and add the field path to uncertainFields.",
    "Locate the Shop and Inventory labels first, then read item sprites by their positions relative to those anchors.",
    "Sale labels and price tags are not items; attach them as sale/price metadata to the nearby item sprite.",
    ...recognitionContext,
    "If you are unsure about a field, use a plausible value and include that field path in uncertainFields.",
    "Use local BPB item names from the grounded list when possible. Do not invent item facts.",
    "",
    "Write or return JSON for this target file:",
    input.resultPath,
    "",
    "GameState shape:",
    JSON.stringify(
      {
        round: 1,
        gold: 10,
        lives: 5,
        wins: 0,
        className: "Ranger",
        bagChoice: null,
        skills: [],
        subclass: null,
        shopItems: [{ name: "Broom", slot: "shop-1", sale: false, price: 3 }],
        backpackItems: [{ name: "Hero Sword", location: "bag", x: 0, y: 0 }],
        storageItems: [],
        userGoal: "learn",
        uncertainFields: [],
      },
      null,
      2,
    ),
    "",
    "Pixel validation:",
    JSON.stringify(input.validation, null, 2),
    "",
    "Grounded BPB item context:",
    JSON.stringify(input.relevantItems, null, 2),
  ].join("\n");
}

function handoffPaths(id: string, baseDir?: string, mimeType = "image/png") {
  const dir = join(handoffBaseDir(baseDir), id);
  const screenshotPath = join(dir, `screenshot.${safeMimeExtension(mimeType)}`);

  return {
    dir,
    handoffPath: join(dir, "handoff.json"),
    promptPath: join(dir, "prompt.md"),
    resultPath: join(dir, "result.json"),
    screenshotPath,
  };
}

function parseStoredRecognitionReport(value: unknown): ItemRecognitionReport | null {
  if (value === null || value === undefined) {
    return null;
  }

  return CodexItemRecognitionReportSchema.parse(value) as ItemRecognitionReport;
}

export async function createCodexHandoff(input: CreateCodexHandoffInput): Promise<CreatedCodexHandoff> {
  const id = randomUUID();
  const paths = handoffPaths(id, input.baseDir, input.mimeType);
  const items = relevantItems(input.bpbCache);
  const itemRecognitionReport = parseStoredRecognitionReport(input.itemRecognitionReport);
  const prompt = buildPrompt({
    resultPath: paths.resultPath,
    screenshotPath: paths.screenshotPath,
    validation: input.validation,
    relevantItems: items,
    itemRecognitionReport,
  });
  const handoff = {
    ...CodexHandoffSchema.parse({
      id,
      createdAt: new Date().toISOString(),
      mimeType: input.mimeType,
      screenshotPath: paths.screenshotPath,
      promptPath: paths.promptPath,
      resultPath: paths.resultPath,
      validation: input.validation,
      relevantItems: items,
      itemRecognitionReport,
    }),
    itemRecognitionReport,
  };

  await mkdir(paths.dir, { recursive: true });
  await Promise.all([
    writeFile(paths.screenshotPath, input.image),
    writeFile(paths.promptPath, prompt, "utf8"),
    writeFile(paths.handoffPath, `${JSON.stringify(handoff, null, 2)}\n`, "utf8"),
  ]);

  return {
    id,
    status: "pending",
    screenshotPath: paths.screenshotPath,
    promptPath: paths.promptPath,
    resultPath: paths.resultPath,
    prompt,
    relevantItems: items,
  };
}

export async function readCodexHandoff(id: string, baseDir?: string) {
  const resolvedBaseDir = handoffBaseDir(baseDir);
  const handoffPath = join(resolvedBaseDir, id, "handoff.json");

  if (!isAbsolute(handoffPath) || !handoffPath.startsWith(resolvedBaseDir)) {
    throw new Error("Invalid handoff path");
  }

  const raw = JSON.parse(await readFile(handoffPath, "utf8"));

  return {
    ...CodexHandoffSchema.parse(raw),
    itemRecognitionReport: parseStoredRecognitionReport(raw.itemRecognitionReport),
  };
}

export async function readCodexHandoffResult(id: string, baseDir?: string): Promise<CodexHandoffResult> {
  const handoff = await readCodexHandoff(id, baseDir);

  try {
    const parsed = CodexHandoffResultSchema.parse(JSON.parse(await readFile(handoff.resultPath, "utf8")));
    const gameState = "gameState" in parsed ? parsed.gameState : parsed;

    return {
      status: "complete",
      gameState: GameStateSchema.parse(gameState),
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { status: "pending" };
    }

    throw error;
  }
}
