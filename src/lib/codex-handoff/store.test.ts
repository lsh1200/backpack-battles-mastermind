import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { BpbCache } from "@/lib/bpb/schemas";
import type { GameState, ValidationReport } from "@/lib/core/types";
import { createCodexHandoff, readCodexHandoffResult } from "./store";

let tempDir: string;

const validation: ValidationReport = {
  image: { width: 2400, height: 1080, orientation: "landscape" },
  regions: [],
  warnings: [],
  requiresConfirmation: [],
};

const cache: BpbCache = {
  fetchedAt: "2026-04-27T00:00:00.000Z",
  patchVersion: "1.1.1",
  patchDate: "2026-04-03T08:01:07.000Z",
  sourceUrls: ["https://bpb-builds.vercel.app/items"],
  items: [
    {
      id: 44,
      name: "Broom",
      aliases: ["broom"],
      imageUrl: "https://awerc.github.io/bpb-cdn/i/Broom.webp",
      grounded: true,
      rarity: "Common",
      tags: ["Weapon"],
    },
    {
      id: 99,
      name: "Unknown Dev Item",
      aliases: ["unknown dev item"],
      grounded: false,
      tags: [],
    },
  ],
  builds: [],
};

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

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "codex-handoff-"));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe("Codex handoff store", () => {
  it("creates a handoff package with a prompt, screenshot, and result target", async () => {
    const handoff = await createCodexHandoff({
      baseDir: tempDir,
      bpbCache: cache,
      image: Buffer.from("fake image"),
      mimeType: "image/png",
      validation,
    });

    expect(handoff.id).toHaveLength(36);
    expect(handoff.status).toBe("pending");
    expect(handoff.relevantItems).toEqual([
      {
        id: 44,
        name: "Broom",
        rarity: "Common",
        tags: ["Weapon"],
      },
    ]);
    await expect(readFile(handoff.screenshotPath, "utf8")).resolves.toBe("fake image");
    await expect(readFile(handoff.promptPath, "utf8")).resolves.toContain("Use view_image on this screenshot");
    expect(handoff.prompt).toContain("Broom");
    expect(handoff.prompt).toContain("Locate the Shop and Inventory labels first");
    expect(handoff.prompt).toContain("Sale labels and price tags are not items");
    expect(handoff.prompt).toContain("Do not identify item names by raw visual guessing");
    expect(handoff.prompt).toContain("This Codex handoff is an LLM fallback");
    expect(handoff.resultPath.endsWith("result.json")).toBe(true);
  });

  it("includes deterministic recognition candidates in the handoff prompt when available", async () => {
    const handoff = await createCodexHandoff({
      baseDir: tempDir,
      bpbCache: cache,
      image: Buffer.from("fake image"),
      mimeType: "image/png",
      validation,
      itemRecognitionReport: {
        source: "mixed",
        shopItems: [{ name: "Unknown Item", slot: "shop-1", sale: false }],
        backpackItems: [],
        uncertainFields: ["shopItems.0.name"],
        warnings: ["shop-1 local template confidence is low."],
        candidateOptionsByField: {
          "shopItems.0.name": ["Stone", "Banana", "Broom"],
        },
        matches: [],
      },
    });

    expect(handoff.prompt).toContain("Deterministic local recognition candidates");
    expect(handoff.prompt).toContain("shopItems.0.name");
    expect(handoff.prompt).toContain("Stone");
  });

  it("reports pending until result.json exists, then parses Codex GameState output", async () => {
    const handoff = await createCodexHandoff({
      baseDir: tempDir,
      bpbCache: cache,
      image: Buffer.from("fake image"),
      mimeType: "image/png",
      validation,
    });

    await expect(readCodexHandoffResult(handoff.id, tempDir)).resolves.toEqual({ status: "pending" });

    await writeFile(handoff.resultPath, `${JSON.stringify({ gameState })}\n`, "utf8");

    await expect(readCodexHandoffResult(handoff.id, tempDir)).resolves.toEqual({
      status: "complete",
      gameState,
    });
  });
});
