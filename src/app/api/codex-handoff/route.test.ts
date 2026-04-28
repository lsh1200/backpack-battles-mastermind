import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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
    .composite([
      {
        input: Buffer.from(
          `<svg width="1200" height="700" xmlns="http://www.w3.org/2000/svg">
            <rect x="20" y="22" width="55" height="40" fill="#f6d85f"/>
            <rect x="128" y="25" width="52" height="45" fill="#326dff"/>
          </svg>`,
        ),
      },
    ])
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

    const screenshotResponse = await GET(
      new Request(`http://localhost/api/codex-handoff?id=${created.handoffId}&asset=screenshot`),
    );
    const screenshotBytes = await screenshotResponse.arrayBuffer();

    expect(screenshotResponse.status).toBe(200);
    expect(screenshotResponse.headers.get("content-type")).toBe("image/png");
    expect(screenshotBytes.byteLength).toBeGreaterThan(0);

    const handoffPath = join(tempDir, created.handoffId, "handoff.json");
    const handoff = JSON.parse(await readFile(handoffPath, "utf8"));
    await writeFile(
      handoffPath,
      `${JSON.stringify(
        {
          ...handoff,
          itemRecognitionReport: {
            source: "mixed",
            shopItems: [],
            backpackItems: [],
            uncertainFields: ["shopItems.0.name"],
            warnings: [],
            candidateOptionsByField: {},
            matches: [
              {
                region: "shop",
                slot: "top-right",
                field: "shopItems.0.name",
                crop: { x: 10, y: 12, width: 80, height: 70 },
                accepted: false,
                candidates: [],
              },
            ],
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const cropResponse = await GET(
      new Request(`http://localhost/api/codex-handoff?id=${created.handoffId}&asset=crop&field=shopItems.0.name`),
    );
    const cropBytes = Buffer.from(await cropResponse.arrayBuffer());
    const cropMetadata = await sharp(cropBytes).metadata();
    const cropPixels = await sharp(cropBytes).removeAlpha().raw().toBuffer();
    let bluePixels = 0;
    for (let index = 0; index < cropPixels.length; index += 3) {
      if ((cropPixels[index] ?? 0) < 80 && (cropPixels[index + 1] ?? 0) < 130 && (cropPixels[index + 2] ?? 0) > 180) {
        bluePixels += 1;
      }
    }

    expect(cropResponse.status).toBe(200);
    expect(cropResponse.headers.get("content-type")).toBe("image/png");
    expect(cropMetadata.width).toBeGreaterThan(0);
    expect(cropMetadata.height).toBeGreaterThan(0);
    expect(bluePixels).toBeGreaterThan(100);

    await writeFile(handoffPath, `${JSON.stringify(handoff, null, 2)}\n`, "utf8");
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
