import { describe, expect, it } from "vitest";
import type { BpbItem } from "@/lib/bpb/schemas";
import type { GameState } from "@/lib/core/types";
import { extractGameStateWithVision, parseVisionJson, toDataUrl, type VisionClient } from "./openai";

const broom: BpbItem = {
  id: 44,
  name: "Broom",
  aliases: ["broom"],
  grounded: true,
  tags: [],
};

const mysteryBlade: BpbItem = {
  id: 999,
  name: "Mystery Blade",
  aliases: ["mystery blade"],
  grounded: false,
  tags: [],
};

const gameState: GameState = {
  round: 2,
  gold: 7,
  lives: 5,
  wins: 1,
  className: "Ranger",
  bagChoice: "Ranger Bag",
  skills: [],
  subclass: null,
  shopItems: [{ name: "Broom", slot: "shop-1", sale: false, groundedBpbId: 44 }],
  backpackItems: [],
  storageItems: [],
  userGoal: "learn",
  uncertainFields: [],
};

type VisionRequest = {
  model: string;
  input: Array<{
    role: string;
    content: Array<{
      type: string;
      text?: string;
      image_url?: string;
    }>;
  }>;
};

describe("OpenAI vision helpers", () => {
  function mockClient(calls: VisionRequest[], output: unknown = gameState): VisionClient {
    return {
      responses: {
        create: async (request) => {
          calls.push(request as VisionRequest);
          return { output_text: JSON.stringify(output) };
        },
      },
    };
  }

  it("converts images to data URLs", () => {
    const url = toDataUrl(Buffer.from("abc"), "image/png");
    expect(url).toBe("data:image/png;base64,YWJj");
  });

  it("parses fenced JSON returned by the model", () => {
    const parsed = parseVisionJson('```json\n{"className":"Ranger","shopItems":[]}\n```');
    expect(parsed).toEqual({ className: "Ranger", shopItems: [] });
  });

  it("extracts a game state with a mocked Responses client", async () => {
    const calls: VisionRequest[] = [];
    const client = mockClient(calls);

    const extracted = await extractGameStateWithVision({
      image: Buffer.from("abc"),
      mimeType: "image/png",
      relevantItems: [broom],
      client,
      model: "test-vision-model",
    });

    expect(extracted).toEqual(gameState);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.model).toBe("test-vision-model");
    expect(calls[0]?.input[0]?.content.some((part) => part.text?.includes("Broom"))).toBe(true);
    expect(calls[0]?.input[0]?.content).toContainEqual({
      type: "input_image",
      image_url: "data:image/png;base64,YWJj",
      detail: "high",
    });
  });

  it("excludes ungrounded BPB item names from the vision prompt", async () => {
    const calls: VisionRequest[] = [];

    await extractGameStateWithVision({
      image: Buffer.from("abc"),
      mimeType: "image/png",
      relevantItems: [broom, mysteryBlade],
      client: mockClient(calls),
    });

    const text = calls[0]?.input[0]?.content.find((part) => part.type === "input_text")?.text ?? "";
    expect(text).toContain("Broom");
    expect(text).not.toContain("Mystery Blade");
  });

  it("tells vision to use shop and inventory anchors instead of treating labels as items", async () => {
    const calls: VisionRequest[] = [];

    await extractGameStateWithVision({
      image: Buffer.from("abc"),
      mimeType: "image/png",
      relevantItems: [broom],
      client: mockClient(calls),
    });

    const text = calls[0]?.input[0]?.content.find((part) => part.type === "input_text")?.text ?? "";
    expect(text).toContain("Shop");
    expect(text).toContain("Inventory");
    expect(text).toContain("Sale labels and price tags are not items");
  });

  it("does not present the LLM as the primary item recognizer", async () => {
    const calls: VisionRequest[] = [];

    await extractGameStateWithVision({
      image: Buffer.from("abc"),
      mimeType: "image/png",
      relevantItems: [broom],
      client: mockClient(calls),
    });

    const text = calls[0]?.input[0]?.content.find((part) => part.type === "input_text")?.text ?? "";
    expect(text).toContain("Do not identify item names by raw visual guessing");
    expect(text).toContain("local BPB item list");
    expect(text).toContain("LLM fallback");
  });

  it("uses the model environment override and default model with injected clients", async () => {
    const originalModel = process.env.OPENAI_VISION_MODEL;
    const envCalls: VisionRequest[] = [];
    const defaultCalls: VisionRequest[] = [];

    try {
      process.env.OPENAI_VISION_MODEL = "env-vision-model";
      await extractGameStateWithVision({
        image: Buffer.from("abc"),
        mimeType: "image/png",
        relevantItems: [],
        client: mockClient(envCalls),
      });

      delete process.env.OPENAI_VISION_MODEL;
      await extractGameStateWithVision({
        image: Buffer.from("abc"),
        mimeType: "image/png",
        relevantItems: [],
        client: mockClient(defaultCalls),
      });
    } finally {
      process.env.OPENAI_VISION_MODEL = originalModel;
    }

    expect(envCalls[0]?.model).toBe("env-vision-model");
    expect(defaultCalls[0]?.model).toBe("gpt-4.1-mini");
  });

  it("rejects schema-invalid model output", async () => {
    const calls: VisionRequest[] = [];

    await expect(
      extractGameStateWithVision({
        image: Buffer.from("abc"),
        mimeType: "image/png",
        relevantItems: [],
        client: mockClient(calls, { className: "Ranger" }),
      }),
    ).rejects.toThrow();
  });

  it("requires an API key when no client is injected", async () => {
    const originalApiKey = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;

    try {
      await expect(
        extractGameStateWithVision({
          image: Buffer.from("abc"),
          mimeType: "image/png",
          relevantItems: [],
        }),
      ).rejects.toThrow("OPENAI_API_KEY is not set");
    } finally {
      process.env.OPENAI_API_KEY = originalApiKey;
    }
  });
});
