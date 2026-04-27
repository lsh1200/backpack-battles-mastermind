import { z } from "zod";

export const UserGoalSchema = z.enum(["learn", "climb", "force-plan", "experiment"]);

export const ShopItemSchema = z.object({
  name: z.string().min(1),
  slot: z.string().min(1),
  sale: z.boolean().default(false),
  price: z.number().int().nonnegative().optional(),
  groundedBpbId: z.number().int().nonnegative().optional(),
});

export const BackpackItemSchema = z.object({
  name: z.string().min(1),
  location: z.enum(["bag", "storage", "shop", "unknown"]),
  x: z.number().int().nonnegative().optional(),
  y: z.number().int().nonnegative().optional(),
  groundedBpbId: z.number().int().nonnegative().optional(),
});

export const GameStateSchema = z.object({
  round: z.number().int().min(1).max(18).nullable(),
  gold: z.number().int().nonnegative().nullable(),
  lives: z.number().int().min(0).max(5).nullable(),
  wins: z.number().int().min(0).max(18).nullable(),
  className: z.string().min(1),
  bagChoice: z.string().nullable(),
  skills: z.array(z.string()),
  subclass: z.string().nullable(),
  shopItems: z.array(ShopItemSchema),
  backpackItems: z.array(BackpackItemSchema),
  storageItems: z.array(BackpackItemSchema),
  battleLogSummary: z.string().optional(),
  userGoal: UserGoalSchema.default("learn"),
  uncertainFields: z.array(z.string()),
});

export const ValidationRegionSchema = z.object({
  name: z.string(),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  occupiedRatio: z.number().min(0).max(1).optional(),
});

export const ValidationReportSchema = z.object({
  image: z.object({
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    orientation: z.enum(["landscape", "portrait", "square"]),
  }),
  regions: z.array(ValidationRegionSchema),
  warnings: z.array(z.string()),
  requiresConfirmation: z.array(z.string()),
});

export const CorrectionQuestionSchema = z.object({
  field: z.string().min(1),
  question: z.string().min(1),
  options: z.array(z.string()).min(1),
});

export const CandidateActionSchema = z.object({
  type: z.enum(["buy", "sell", "roll", "lock", "reposition", "combine", "pick-skill", "pick-subclass", "start-battle"]),
  target: z.string(),
  value: z.number(),
  risks: z.array(z.string()),
  assumptions: z.array(z.string()),
  teachingReason: z.string(),
});

export const RecommendationSchema = z.object({
  bestAction: CandidateActionSchema,
  shortReason: z.string().min(1),
  rejectedAlternatives: z.array(CandidateActionSchema),
  planSupported: z.string().min(1),
  nextTargets: z.array(z.string()),
  assumptionsMade: z.array(z.string()),
  correctionPromptsUsed: z.array(z.string()),
});

export const AnalysisResultSchema = z.object({
  gameState: GameStateSchema,
  validation: ValidationReportSchema,
  correctionQuestions: z.array(CorrectionQuestionSchema),
  recommendation: RecommendationSchema.nullable(),
});
