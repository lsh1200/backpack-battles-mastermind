import { z } from "zod";
import { GameStateSchema, ValidationReportSchema } from "@/lib/core/schemas";

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

export const CodexHandoffSchema = z.object({
  id: z.string().uuid(),
  createdAt: z.string(),
  mimeType: z.string().min(1),
  screenshotPath: z.string().min(1),
  promptPath: z.string().min(1),
  resultPath: z.string().min(1),
  validation: ValidationReportSchema,
  relevantItems: z.array(CodexHandoffItemSchema),
});

export const CodexHandoffResultSchema = z.union([GameStateSchema, z.object({ gameState: GameStateSchema })]);

export type CodexHandoff = z.infer<typeof CodexHandoffSchema>;
export type CodexHandoffItem = z.infer<typeof CodexHandoffItemSchema>;
