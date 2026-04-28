import OpenAI from "openai";
import type { BpbItem } from "@/lib/bpb/schemas";
import { GameStateSchema } from "@/lib/core/schemas";
import type { GameState } from "@/lib/core/types";

type ExtractInput = {
  image: Buffer;
  mimeType: string;
  relevantItems: BpbItem[];
  client?: VisionClient;
  model?: string;
  apiKey?: string;
};

type VisionContentPart =
  | {
      type: "input_text";
      text: string;
    }
  | {
      type: "input_image";
      image_url: string;
      detail: "high";
    };

type VisionRequest = {
  model: string;
  input: Array<{
    role: "user";
    content: VisionContentPart[];
  }>;
};

export type VisionClient = {
  responses: {
    create: (request: VisionRequest) => Promise<{ output_text: string }>;
  };
};

export function toDataUrl(image: Buffer, mimeType: string): string {
  return `data:${mimeType};base64,${image.toString("base64")}`;
}

export function parseVisionJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return JSON.parse((fenced?.[1] ?? trimmed).trim());
}

function nonBlank(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function buildVisionRequest(input: ExtractInput, model: string): VisionRequest {
  const itemNames = input.relevantItems
    .filter((item) => item.grounded)
    .map((item) => item.name)
    .join(", ");

  return {
    model,
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: [
              "Audit this Backpack Battles shop screenshot for a local-first recognizer.",
              "Return only JSON matching the GameState shape.",
              "Do not identify item names by raw visual guessing. The local BPB item list and user corrections are the authority for item identity.",
              "Treat LLM fallback item reads as provisional: if a sprite cannot be matched to a local BPB item, use Unknown Item and add the field path to uncertainFields.",
              "Locate the Shop and Inventory labels first, then read item sprites by their positions relative to those anchors.",
              "Sale labels and price tags are not items; attach them as sale/price metadata to the nearby item sprite.",
              "Use these grounded BPB item names when possible:",
              itemNames || "No local items were provided.",
              "Use uncertainFields for any class, gold, round, item, or location you are not confident about.",
            ].join("\n"),
          },
          {
            type: "input_image",
            image_url: toDataUrl(input.image, input.mimeType),
            detail: "high",
          },
        ],
      },
    ],
  };
}

export async function extractGameStateWithVision(input: ExtractInput): Promise<GameState> {
  const model = nonBlank(input.model) ?? nonBlank(process.env.OPENAI_VISION_MODEL) ?? "gpt-4.1-mini";
  const request = buildVisionRequest(input, model);
  const response = input.client
    ? await input.client.responses.create(request)
    : await new OpenAI({ apiKey: nonBlank(input.apiKey) ?? requiredOpenAIApiKey() }).responses.create(request);

  return GameStateSchema.parse(parseVisionJson(response.output_text));
}

function requiredOpenAIApiKey(): string {
  const apiKey = nonBlank(process.env.OPENAI_API_KEY);
  if (apiKey === undefined) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  return apiKey;
}
