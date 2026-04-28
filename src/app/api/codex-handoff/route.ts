import { NextResponse } from "next/server";
import { analyzeCorrectedState } from "@/lib/analysis/analyze";
import { readBpbCache } from "@/lib/bpb/store";
import { AnalysisResultSchema } from "@/lib/core/schemas";
import { createCodexHandoff, readCodexHandoff, readCodexHandoffResult } from "@/lib/codex-handoff/store";
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
    const handoff = await createCodexHandoff({
      bpbCache,
      image,
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
  const handoffId = new URL(request.url).searchParams.get("id");

  if (!handoffId) {
    return NextResponse.json({ error: "handoff id is required" }, { status: 400 });
  }

  try {
    const handoff = await readCodexHandoff(handoffId);
    const handoffResult = await readCodexHandoffResult(handoffId);

    if (handoffResult.status === "pending") {
      return NextResponse.json({
        status: "pending",
        handoffId,
        promptPath: handoff.promptPath,
        resultPath: handoff.resultPath,
      });
    }

    const bpbCache = await readBpbCache();
    const result = AnalysisResultSchema.parse(
      await analyzeCorrectedState({
        gameState: handoffResult.gameState,
        validation: handoff.validation,
        bpbCache,
        correctionPromptsUsed: ["codex-test-mode"],
      }),
    );

    return NextResponse.json({ status: "complete", handoffId, result });
  } catch (error) {
    const status = (error as NodeJS.ErrnoException).code === "ENOENT" ? 404 : 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to read Codex handoff" },
      { status },
    );
  }
}
