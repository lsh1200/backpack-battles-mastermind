import sharp from "sharp";
import { describe, expect, it } from "vitest";
import type { BpbCache } from "@/lib/bpb/schemas";
import type { GameState } from "@/lib/core/types";
import {
  applyItemRecognitionToGameState,
  type ItemRecognitionReport,
  recognizeItemsFromScreenshot,
  type RecognitionScreenProfile,
} from "./item-recognizer";

async function squareDataUrl(color: string): Promise<string> {
  const image = await sharp({
    create: {
      width: 32,
      height: 32,
      channels: 4,
      background: color,
    },
  })
    .png()
    .toBuffer();

  return `data:image/png;base64,${image.toString("base64")}`;
}

async function screenshotWithSquare(color: string): Promise<Buffer> {
  const base = await sharp({
    create: {
      width: 160,
      height: 96,
      channels: 4,
      background: "#111111",
    },
  })
    .composite([
      {
        input: await sharp({
          create: {
            width: 32,
            height: 32,
            channels: 4,
            background: color,
          },
        })
          .png()
          .toBuffer(),
        left: 24,
        top: 20,
      },
    ])
    .png()
    .toBuffer();

  return base;
}

async function cache(): Promise<BpbCache> {
  return {
    fetchedAt: "2026-04-28T00:00:00.000Z",
    patchVersion: "1.1.1",
    patchDate: "2026-04-03T08:01:07.000Z",
    sourceUrls: ["https://bpb-builds.vercel.app/items"],
    items: [
      {
        id: 0,
        name: "Stone",
        aliases: ["stone"],
        imageUrl: await squareDataUrl("#999999"),
        grounded: true,
        tags: [],
      },
      {
        id: 5,
        name: "Banana",
        aliases: ["banana"],
        imageUrl: await squareDataUrl("#f7d547"),
        grounded: true,
        tags: [],
      },
      {
        id: 44,
        name: "Broom",
        aliases: ["broom"],
        imageUrl: await squareDataUrl("#7a3f1f"),
        grounded: true,
        tags: [],
      },
    ],
    builds: [],
  };
}

const profile: RecognitionScreenProfile = {
  shopSlots: [{ slot: "shop-1", crop: { x: 24, y: 20, width: 32, height: 32 } }],
  backpackSlots: [],
};

function baseGameState(overrides: Partial<GameState> = {}): GameState {
  return {
    round: 1,
    gold: 13,
    lives: 5,
    wins: 0,
    className: "Ranger",
    bagChoice: "Ranger Bag",
    skills: [],
    subclass: null,
    shopItems: [],
    backpackItems: [],
    storageItems: [],
    userGoal: "learn",
    uncertainFields: [],
    ...overrides,
  };
}

describe("deterministic item recognizer", () => {
  it("matches a shop crop against local BPB icon templates", async () => {
    const report = await recognizeItemsFromScreenshot({
      image: await screenshotWithSquare("#f7d547"),
      bpbCache: await cache(),
      profile,
    });

    expect(report.source).toBe("local-first");
    expect(report.shopItems).toEqual([
      {
        name: "Banana",
        slot: "shop-1",
        sale: false,
        groundedBpbId: 5,
      },
    ]);
    expect(report.matches[0]?.candidates.map((candidate) => candidate.name).slice(0, 2)).toEqual(["Banana", "Stone"]);
    expect(report.uncertainFields).toEqual([]);
  });

  it("keeps low-confidence crops out of item authority and asks for confirmation with local candidates", async () => {
    const report = await recognizeItemsFromScreenshot({
      image: await screenshotWithSquare("#1f78d1"),
      bpbCache: await cache(),
      profile,
    });

    expect(report.source).toBe("mixed");
    expect(report.shopItems).toEqual([
      {
        name: "Unknown Item",
        slot: "shop-1",
        sale: false,
      },
    ]);
    expect(report.uncertainFields).toEqual(["shopItems.0.name"]);
    expect(report.candidateOptionsByField["shopItems.0.name"]).toHaveLength(3);
    expect(report.warnings[0]).toContain("local template confidence");
  });

  it("applies deterministic item names over vision item guesses while preserving shop metadata", async () => {
    const report = await recognizeItemsFromScreenshot({
      image: await screenshotWithSquare("#999999"),
      bpbCache: await cache(),
      profile,
    });
    const merged = applyItemRecognitionToGameState(
      baseGameState({
        shopItems: [{ name: "Customer Card", slot: "shop-1", sale: true, price: 1 }],
      }),
      report,
    );

    expect(merged.shopItems).toEqual([
      {
        name: "Stone",
        slot: "shop-1",
        sale: true,
        price: 1,
        groundedBpbId: 0,
      },
    ]);
    expect(merged.uncertainFields).toEqual([]);
  });

  it("preserves vision item names when local template matching is uncertain", async () => {
    const report = await recognizeItemsFromScreenshot({
      image: await screenshotWithSquare("#1f78d1"),
      bpbCache: await cache(),
      profile,
    });
    const merged = applyItemRecognitionToGameState(
      baseGameState({
        shopItems: [{ name: "Customer Card", slot: "shop-1", sale: true, price: 4 }],
      }),
      report,
    );

    expect(merged.shopItems).toEqual([
      {
        name: "Customer Card",
        slot: "shop-1",
        sale: true,
        price: 4,
      },
    ]);
    expect(merged.uncertainFields).toEqual(["shopItems.0.name"]);
  });

  it("does not append rejected local-only slots as extra unknown items", () => {
    const report: ItemRecognitionReport = {
      source: "mixed",
      shopItems: [],
      backpackItems: [
        { name: "Unknown Item", location: "bag", x: 0, y: 0 },
        { name: "Unknown Item", location: "bag", x: 3, y: 1 },
      ],
      uncertainFields: ["backpackItems.0.name", "backpackItems.1.name"],
      warnings: ["local template confidence is low."],
      candidateOptionsByField: {},
      matches: [
        {
          region: "backpack",
          slot: "bag-main",
          field: "backpackItems.0.name",
          crop: { x: 0, y: 0, width: 10, height: 10 },
          accepted: false,
          candidates: [],
        },
        {
          region: "backpack",
          slot: "extra",
          field: "backpackItems.1.name",
          crop: { x: 10, y: 0, width: 10, height: 10 },
          accepted: false,
          candidates: [],
        },
      ],
    };
    const merged = applyItemRecognitionToGameState(
      baseGameState({
        backpackItems: [{ name: "Lucky Clover", location: "bag", x: 2, y: 2 }],
      }),
      report,
    );

    expect(merged.backpackItems).toEqual([{ name: "Lucky Clover", location: "bag", x: 2, y: 2 }]);
    expect(merged.uncertainFields).toEqual(["backpackItems.0.name"]);
  });
});
