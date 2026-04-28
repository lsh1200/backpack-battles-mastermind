import { NextResponse } from "next/server";
import { analyzeCorrectedState } from "@/lib/analysis/analyze";
import { readBpbCache } from "@/lib/bpb/store";
import { AnalysisResultSchema, GameStateSchema } from "@/lib/core/schemas";
import { saveAnalysisFixture } from "@/lib/fixtures/store";
import { extractGameStateWithVision } from "@/lib/vision/openai";
import { validateScreenshotPixels } from "@/lib/vision/pixel-validator";

export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get("screenshot");
  const correctedState = form.get("correctedState");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "screenshot file is required" }, { status: 400 });
  }

  const image = Buffer.from(await file.arrayBuffer());
  const [bpbCache, validation] = await Promise.all([readBpbCache(), validateScreenshotPixels(image)]);
  const gameState = correctedState
    ? GameStateSchema.parse(JSON.parse(String(correctedState)))
    : await extractGameStateWithVision({
        image,
        mimeType: file.type || "image/png",
        relevantItems: bpbCache?.items.slice(0, 120) ?? [],
      });

  const result = AnalysisResultSchema.parse(
    await analyzeCorrectedState({
      gameState,
      validation,
      bpbCache,
      correctionPromptsUsed: [],
    }),
  );

  await saveAnalysisFixture(result);
  return NextResponse.json(result);
}
