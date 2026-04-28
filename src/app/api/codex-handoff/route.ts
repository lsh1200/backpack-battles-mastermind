import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import sharp from "sharp";
import { analyzeCorrectedState } from "@/lib/analysis/analyze";
import { readBpbCache } from "@/lib/bpb/store";
import { AnalysisResultSchema } from "@/lib/core/schemas";
import type { AnalysisResult } from "@/lib/core/types";
import { codexHandoffCropUrl } from "@/lib/codex-handoff/client";
import { createCodexHandoff, readCodexHandoff, readCodexHandoffResult } from "@/lib/codex-handoff/store";
import type { CodexHandoff } from "@/lib/codex-handoff/schemas";
import { applyItemRecognitionToGameState, recognizeItemsFromScreenshot } from "@/lib/vision/item-recognizer";
import { validateScreenshotPixels } from "@/lib/vision/pixel-validator";

type Crop = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function clampCrop(crop: Crop, imageWidth: number, imageHeight: number): Crop | null {
  const x = Math.max(0, Math.round(crop.x));
  const y = Math.max(0, Math.round(crop.y));
  const right = Math.min(imageWidth, Math.round(crop.x + crop.width));
  const bottom = Math.min(imageHeight, Math.round(crop.y + crop.height));
  const width = right - x;
  const height = bottom - y;

  return width > 1 && height > 1 ? { x, y, width, height } : null;
}

function displayCrop(match: NonNullable<CodexHandoff["itemRecognitionReport"]>["matches"][number]): Crop {
  if (match.region === "shop") {
    return {
      x: match.crop.x - match.crop.width * 0.15,
      y: match.crop.y - match.crop.height * 0.18,
      width: match.crop.width * 2.3,
      height: match.crop.height * 1.36,
    };
  }

  return {
    x: match.crop.x - match.crop.width * 0.18,
    y: match.crop.y - match.crop.height * 0.18,
    width: match.crop.width * 1.36,
    height: match.crop.height * 1.36,
  };
}

async function cropHandoffScreenshot(handoff: CodexHandoff, field: string): Promise<Buffer | null> {
  const match = handoff.itemRecognitionReport?.matches.find((candidate) => candidate.field === field);
  if (!match) {
    return null;
  }

  const image = await readFile(handoff.screenshotPath);
  const metadata = await sharp(image).rotate().metadata();
  const crop = clampCrop(displayCrop(match), metadata.width ?? 0, metadata.height ?? 0);
  if (!crop) {
    return null;
  }

  return sharp(image)
    .rotate()
    .extract({ left: crop.x, top: crop.y, width: crop.width, height: crop.height })
    .resize({ width: 220, withoutEnlargement: true })
    .png()
    .toBuffer();
}

function withCropUrls(result: AnalysisResult, handoffId: string, handoff: CodexHandoff): AnalysisResult {
  const cropFields = new Set(handoff.itemRecognitionReport?.matches.map((match) => match.field) ?? []);

  return {
    ...result,
    correctionQuestions: result.correctionQuestions.map((question) =>
      cropFields.has(question.field) ? { ...question, imageUrl: codexHandoffCropUrl(handoffId, question.field) } : question,
    ),
  };
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("screenshot");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "screenshot file is required" }, { status: 400 });
    }

    const image = Buffer.from(await file.arrayBuffer());
    const [bpbCache, validation] = await Promise.all([readBpbCache(), validateScreenshotPixels(image)]);
    const itemRecognitionReport = await recognizeItemsFromScreenshot({ image, bpbCache });
    const handoff = await createCodexHandoff({
      bpbCache,
      image,
      itemRecognitionReport,
      mimeType: file.type || "image/png",
      validation,
    });

    return NextResponse.json({
      status: handoff.status,
      handoffId: handoff.id,
      prompt: handoff.prompt,
      promptPath: handoff.promptPath,
      resultPath: handoff.resultPath,
      screenshotPath: handoff.screenshotPath,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create Codex handoff" },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const handoffId = url.searchParams.get("id");
  const asset = url.searchParams.get("asset");

  if (!handoffId) {
    return NextResponse.json({ error: "handoff id is required" }, { status: 400 });
  }

  try {
    const handoff = await readCodexHandoff(handoffId);

    if (asset === "screenshot") {
      const image = await readFile(handoff.screenshotPath);
      const body = image.buffer.slice(image.byteOffset, image.byteOffset + image.byteLength) as ArrayBuffer;

      return new NextResponse(body, {
        headers: {
          "cache-control": "no-store",
          "content-type": handoff.mimeType,
        },
      });
    }

    if (asset === "crop") {
      const field = url.searchParams.get("field");
      if (!field) {
        return NextResponse.json({ error: "crop field is required" }, { status: 400 });
      }

      const crop = await cropHandoffScreenshot(handoff, field);
      if (!crop) {
        return NextResponse.json({ error: "crop not found" }, { status: 404 });
      }

      const body = crop.buffer.slice(crop.byteOffset, crop.byteOffset + crop.byteLength) as ArrayBuffer;

      return new NextResponse(body, {
        headers: {
          "cache-control": "no-store",
          "content-type": "image/png",
        },
      });
    }

    if (asset) {
      return NextResponse.json({ error: "unsupported handoff asset" }, { status: 400 });
    }

    const handoffResult = await readCodexHandoffResult(handoffId);
    const prompt = await readFile(handoff.promptPath, "utf8");
    const handoffMetadata = {
      handoffId,
      prompt,
      promptPath: handoff.promptPath,
      resultPath: handoff.resultPath,
      screenshotPath: handoff.screenshotPath,
    };

    if (handoffResult.status === "pending") {
      return NextResponse.json({
        status: "pending",
        ...handoffMetadata,
      });
    }

    const bpbCache = await readBpbCache();
    const result = AnalysisResultSchema.parse(
      await analyzeCorrectedState({
        gameState: applyItemRecognitionToGameState(handoffResult.gameState, handoff.itemRecognitionReport ?? null),
        validation: handoff.validation,
        bpbCache,
        correctionPromptsUsed: ["codex-test-mode"],
        itemRecognitionSource: handoff.itemRecognitionReport?.source ?? "llm-fallback",
        candidateOptionsByField: handoff.itemRecognitionReport?.candidateOptionsByField,
      }),
    );

    return NextResponse.json({ status: "complete", ...handoffMetadata, result: withCropUrls(result, handoffId, handoff) });
  } catch (error) {
    const status = (error as NodeJS.ErrnoException).code === "ENOENT" ? 404 : 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to read Codex handoff" },
      { status },
    );
  }
}
