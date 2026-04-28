import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { analyzeCorrectedState } from "@/lib/analysis/analyze";
import { readBpbCache } from "@/lib/bpb/store";
import { AnalysisResultSchema } from "@/lib/core/schemas";
import { createCodexHandoff, readCodexHandoff, readCodexHandoffResult } from "@/lib/codex-handoff/store";
import { applyItemRecognitionToGameState, recognizeItemsFromScreenshot } from "@/lib/vision/item-recognizer";
import { validateScreenshotPixels } from "@/lib/vision/pixel-validator";

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

    return NextResponse.json({ status: "complete", ...handoffMetadata, result });
  } catch (error) {
    const status = (error as NodeJS.ErrnoException).code === "ENOENT" ? 404 : 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to read Codex handoff" },
      { status },
    );
  }
}
