import { NextResponse } from "next/server";
import { analyzeCorrectedState } from "@/lib/analysis/analyze";
import { readBpbCache } from "@/lib/bpb/store";
import { AnalysisResultSchema, GameStateSchema, ValidationReportSchema } from "@/lib/core/schemas";
import { saveAnalysisFixture } from "@/lib/fixtures/store";
import { applyItemRecognitionToGameState, recognizeItemsFromScreenshot } from "@/lib/vision/item-recognizer";
import { extractGameStateWithVision } from "@/lib/vision/openai";
import { validateScreenshotPixels } from "@/lib/vision/pixel-validator";

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("screenshot");
    const correctedState = form.get("correctedState");
    const postedValidation = form.get("validation");
    const hasCorrectedState = typeof correctedState === "string" && correctedState.trim().length > 0;
    const screenshot = file instanceof File ? file : null;

    if (!screenshot && !hasCorrectedState) {
      return NextResponse.json({ error: "screenshot file is required" }, { status: 400 });
    }

    if (!screenshot && hasCorrectedState && typeof postedValidation !== "string") {
      return NextResponse.json({ error: "validation is required when screenshot is omitted" }, { status: 400 });
    }

    if (!hasCorrectedState && !process.env.OPENAI_API_KEY?.trim()) {
      return NextResponse.json({ error: "OPENAI_API_KEY is not set" }, { status: 500 });
    }

    const image = screenshot ? Buffer.from(await screenshot.arrayBuffer()) : null;
    const [bpbCache, validation] = await Promise.all([
      readBpbCache(),
      image ? validateScreenshotPixels(image) : ValidationReportSchema.parse(JSON.parse(String(postedValidation))),
    ]);
    const itemRecognitionReport = hasCorrectedState
      ? null
      : await recognizeItemsFromScreenshot({
          image: image as Buffer,
          bpbCache,
          validation,
        });
    const gameState = hasCorrectedState
      ? GameStateSchema.parse(JSON.parse(String(correctedState)))
      : applyItemRecognitionToGameState(
          await extractGameStateWithVision({
            image: image as Buffer,
            mimeType: screenshot?.type || "image/png",
            relevantItems: bpbCache?.items.slice(0, 120) ?? [],
            deterministicRecognition: itemRecognitionReport,
          }),
          itemRecognitionReport,
        );

    const result = AnalysisResultSchema.parse(
      await analyzeCorrectedState({
        gameState,
        validation,
        bpbCache,
        correctionPromptsUsed: [],
        itemRecognitionSource: hasCorrectedState ? "user-confirmed" : itemRecognitionReport?.source,
        candidateOptionsByField: itemRecognitionReport?.candidateOptionsByField,
      }),
    );

    await saveAnalysisFixture(result);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Analysis failed" }, { status: 500 });
  }
}
