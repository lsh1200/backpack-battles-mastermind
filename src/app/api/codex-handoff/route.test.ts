import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { GameState } from "@/lib/core/types";
import { GET, POST } from "./route";

let tempDir: string;
const originalHandoffDir = process.env.CODEX_HANDOFF_DIR;
const originalRecognitionMaxTemplates = process.env.BPB_RECOGNITION_MAX_TEMPLATES;

const gameState: GameState = {
  round: 1,
  gold: 10,
  lives: 5,
  wins: 0,
  className: "Ranger",
  bagChoice: null,
  skills: [],
  subclass: null,
  shopItems: [{ name: "Broom", slot: "shop-1", sale: false }],
  backpackItems: [],
  storageItems: [],
  userGoal: "learn",
  uncertainFields: [],
};

async function screenshotFile(): Promise<File> {
  const image = await sharp({
    create: {
      width: 1200,
      height: 700,
      channels: 3,
      background: "#202020",
    },
  })
    .png()
    .toBuffer();
  const bytes = new Uint8Array(image.byteLength);
  bytes.set(image);

  return new File([bytes.buffer], "round.png", { type: "image/png" });
}

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "codex-handoff-api-"));
  process.env.CODEX_HANDOFF_DIR = tempDir;
  process.env.BPB_RECOGNITION_MAX_TEMPLATES = "0";
});

afterEach(async () => {
  if (originalHandoffDir === undefined) {
    delete process.env.CODEX_HANDOFF_DIR;
  } else {
    process.env.CODEX_HANDOFF_DIR = originalHandoffDir;
  }
  if (originalRecognitionMaxTemplates === undefined) {
    delete process.env.BPB_RECOGNITION_MAX_TEMPLATES;
  } else {
    process.env.BPB_RECOGNITION_MAX_TEMPLATES = originalRecognitionMaxTemplates;
  }
  await rm(tempDir, { recursive: true, force: true });
});

describe("Codex handoff API", () => {
  it("creates a pending handoff and returns analysis after Codex writes result.json", async () => {
    const form = new FormData();
    form.append("screenshot", await screenshotFile());

    const createdResponse = await POST(new Request("http://localhost/api/codex-handoff", { method: "POST", body: form }));
    const created = await createdResponse.json();

    expect(createdResponse.status).toBe(200);
    expect(created.status).toBe("pending");
    expect(created.handoffId).toHaveLength(36);
    expect(created.prompt).toContain("Use view_image on this screenshot");

    const pendingResponse = await GET(new Request(`http://localhost/api/codex-handoff?id=${created.handoffId}`));
    await expect(pendingResponse.json()).resolves.toMatchObject({ status: "pending", handoffId: created.handoffId });

    await writeFile(created.resultPath, `${JSON.stringify({ gameState })}\n`, "utf8");

    const completeResponse = await GET(new Request(`http://localhost/api/codex-handoff?id=${created.handoffId}`));
    const complete = await completeResponse.json();

    expect(complete.status).toBe("complete");
    expect(complete.prompt).toContain("Use view_image on this screenshot");
    expect(complete.promptPath).toBe(created.promptPath);
    expect(complete.resultPath).toBe(created.resultPath);
    expect(complete.screenshotPath).toBe(created.screenshotPath);
    expect(complete.result.gameState.className).toBe("Ranger");
    expect(complete.result.correctionQuestions).toEqual([]);
    expect(complete.result.recommendation).not.toBeNull();
  });
});
