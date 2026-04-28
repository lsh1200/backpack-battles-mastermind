import { readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GameState, ValidationReport } from "@/lib/core/types";
import { POST } from "./route";

const originalOpenAiApiKey = process.env.OPENAI_API_KEY;
const testFixtureDir = join("data", "fixtures");
const testFixturePath = join(testFixtureDir, "2026-01-01T00-00-00-000Z.json");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
});

afterEach(async () => {
  vi.useRealTimers();

  if (originalOpenAiApiKey === undefined) {
    delete process.env.OPENAI_API_KEY;
  } else {
    process.env.OPENAI_API_KEY = originalOpenAiApiKey;
  }

  await rm(testFixturePath, { force: true });
  try {
    if ((await readdir(testFixtureDir)).length === 0) {
      await rm(testFixtureDir, { recursive: true, force: true });
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }
});

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

describe("POST /api/analyze", () => {
  it("returns a JSON setup error when the OpenAI API key is missing", async () => {
    delete process.env.OPENAI_API_KEY;
    const form = new FormData();
    form.append("screenshot", await screenshotFile());

    const response = await POST(new Request("http://localhost/api/analyze", { method: "POST", body: form }));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "OPENAI_API_KEY is not set" });
  });

  it("analyzes a corrected game state without requiring the screenshot file again", async () => {
    delete process.env.OPENAI_API_KEY;
    const gameState: GameState = {
      round: 1,
      gold: 13,
      lives: 5,
      wins: 0,
      className: "Ranger",
      bagChoice: "Ranger Bag",
      skills: [],
      subclass: null,
      shopItems: [
        { name: "Stone", slot: "top-left", sale: false, price: 1 },
        { name: "Banana", slot: "middle-left", sale: false, price: 3 },
      ],
      backpackItems: [
        { name: "Ranger Bag", location: "bag", x: 0, y: 0 },
        { name: "Wooden Sword", location: "bag", x: 1, y: 1 },
      ],
      storageItems: [],
      userGoal: "learn",
      uncertainFields: [],
    };
    const validation: ValidationReport = {
      image: { width: 1280, height: 591, orientation: "landscape" },
      regions: [],
      warnings: [],
      requiresConfirmation: [],
    };
    const form = new FormData();
    form.append("correctedState", JSON.stringify(gameState));
    form.append("validation", JSON.stringify(validation));

    const response = await POST(new Request("http://localhost/api/analyze", { method: "POST", body: form }));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.gameState.className).toBe("Ranger");
    expect(json.correctionQuestions).toEqual([]);
    expect(json.recommendation).not.toBeNull();
  });
});
