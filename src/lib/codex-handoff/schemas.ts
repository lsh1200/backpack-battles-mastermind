import { z } from "zod";
import { BackpackItemSchema, GameStateSchema, ShopItemSchema, ValidationReportSchema } from "@/lib/core/schemas";

export const CodexHandoffItemSchema = z.object({
  id: z.number().int().nonnegative(),
  name: z.string().min(1),
  className: z.string().optional(),
  rarity: z.string().optional(),
  type: z.string().optional(),
  cost: z.number().nonnegative().optional(),
  tags: z.array(z.string()),
  effectText: z.string().optional(),
});

export const CodexRecognitionCandidateSchema = z.object({
  name: z.string().min(1),
  bpbId: z.number().int().nonnegative(),
  score: z.number().min(0).max(1),
});

export const CodexRecognitionMatchSchema = z.object({
  region: z.enum(["shop", "backpack"]),
  slot: z.string().min(1),
  field: z.string().min(1),
  crop: z.object({
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number(),
  }),
  accepted: z.boolean(),
  candidates: z.array(CodexRecognitionCandidateSchema),
});

export const CodexItemRecognitionReportSchema = z.object({
  source: z.enum(["local-first", "user-confirmed", "llm-fallback", "mixed"]),
  shopItems: z.array(ShopItemSchema),
  backpackItems: z.array(BackpackItemSchema),
  uncertainFields: z.array(z.string()),
  warnings: z.array(z.string()),
  candidateOptionsByField: z.record(z.string(), z.array(z.string())),
  matches: z.array(CodexRecognitionMatchSchema),
});

export const CodexHandoffSchema = z.object({
  id: z.string().uuid(),
  createdAt: z.string(),
  mimeType: z.string().min(1),
  screenshotPath: z.string().min(1),
  promptPath: z.string().min(1),
  resultPath: z.string().min(1),
  validation: ValidationReportSchema,
  relevantItems: z.array(CodexHandoffItemSchema),
  itemRecognitionReport: CodexItemRecognitionReportSchema.nullable().optional(),
});

export const CodexHandoffResultSchema = z.union([GameStateSchema, z.object({ gameState: GameStateSchema })]);

export type CodexHandoff = z.infer<typeof CodexHandoffSchema>;
export type CodexHandoffItem = z.infer<typeof CodexHandoffItemSchema>;
