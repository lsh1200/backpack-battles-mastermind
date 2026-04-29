import type { z } from "zod";
import type {
  AnalysisResultSchema,
  BackpackItemSchema,
  CandidateActionSchema,
  CorrectionQuestionSchema,
  GameStateSchema,
  RecommendationSchema,
  ShopItemSchema,
  ValidationReportSchema,
} from "./schemas";

export type AnalysisResult = z.infer<typeof AnalysisResultSchema>;
export type BackpackItem = z.infer<typeof BackpackItemSchema>;
export type CandidateAction = z.infer<typeof CandidateActionSchema>;
export type CorrectionQuestion = z.infer<typeof CorrectionQuestionSchema>;
export type GameState = z.infer<typeof GameStateSchema>;
export type Recommendation = z.infer<typeof RecommendationSchema>;
export type ShopItem = z.infer<typeof ShopItemSchema>;
export type ValidationReport = z.infer<typeof ValidationReportSchema>;
