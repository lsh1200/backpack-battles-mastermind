import { NextResponse } from "next/server";
import { analyzeCorrectedState } from "@/lib/analysis/analyze";
import { readBpbCache } from "@/lib/bpb/store";
import { AnalysisResultSchema, GameStateSchema } from "@/lib/core/schemas";
import { saveAnalysisFixture } from "@/lib/fixtures/store";
import { applyItemRecognitionToGameState, recognizeItemsFromScreenshot } from "@/lib/vision/item-recognizer";
import { extractGameStateWithVision } from "@/lib/vision/openai";
import { validateScreenshotPixels } from "@/lib/vision/pixel-validator";

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("screenshot");
    const correctedState = form.get("correctedState");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "screenshot file is required" }, { status: 400 });
    }

    const image = Buffer.from(await file.arrayBuffer());
    const [bpbCache, validation] = await Promise.all([readBpbCache(), validateScreenshotPixels(image)]);
    const hasCorrectedState = typeof correctedState === "string" && correctedState.trim().length > 0;
    const itemRecognitionReport = hasCorrectedState
      ? null
      : await recognizeItemsFromScreenshot({
          image,
          bpbCache,
        });
    const gameState = hasCorrectedState
      ? GameStateSchema.parse(JSON.parse(String(correctedState)))
      : applyItemRecognitionToGameState(
          await extractGameStateWithVision({
            image,
            mimeType: file.type || "image/png",
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
