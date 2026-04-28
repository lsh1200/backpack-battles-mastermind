import type { BpbCache } from "@/lib/bpb/schemas";
import { findBpbItemByName } from "@/lib/bpb/store";
import type { AnalysisResult, BackpackItem, GameState, Recommendation, ShopItem, ValidationReport } from "@/lib/core/types";
import { recommendNextAction } from "@/lib/strategy/recommend";
import { buildCorrectionQuestions } from "@/lib/vision/correction";

type AnalyzeCorrectedStateInput = {
  gameState: GameState;
  validation: ValidationReport;
  bpbCache: BpbCache | null;
  correctionPromptsUsed: string[];
  itemRecognitionSource?: Recommendation["recognitionPolicy"]["itemRecognition"];
  candidateOptionsByField?: Record<string, string[]>;
};

function knownGroundedItemNames(bpbCache: BpbCache | null): string[] {
  return bpbCache?.items.filter((item) => item.grounded).map((item) => item.name) ?? [];
}

function groundedItemId(bpbCache: BpbCache | null, name: string): number | undefined {
  if (bpbCache === null) {
    return undefined;
  }

  const bpbItem = findBpbItemByName(bpbCache, name);
  return bpbItem?.grounded === true ? bpbItem.id : undefined;
}

function groundShopItem(item: ShopItem, bpbCache: BpbCache | null): ShopItem {
  const groundedBpbId = groundedItemId(bpbCache, item.name);
  const base = {
    name: item.name,
    slot: item.slot,
    sale: item.sale,
    ...(item.price !== undefined ? { price: item.price } : {}),
  };

  return groundedBpbId === undefined ? base : { ...base, groundedBpbId };
}

function groundBackpackItem(item: BackpackItem, bpbCache: BpbCache | null): BackpackItem {
  const groundedBpbId = groundedItemId(bpbCache, item.name);
  const base = {
    name: item.name,
    location: item.location,
    ...(item.itemKind !== undefined ? { itemKind: item.itemKind } : {}),
    ...(item.x !== undefined ? { x: item.x } : {}),
    ...(item.y !== undefined ? { y: item.y } : {}),
    ...(item.footprint !== undefined ? { footprint: item.footprint } : {}),
  };

  return groundedBpbId === undefined ? base : { ...base, groundedBpbId };
}

function groundGameState(gameState: GameState, bpbCache: BpbCache | null): GameState {
  return {
    ...gameState,
    shopItems: gameState.shopItems.map((item) => groundShopItem(item, bpbCache)),
    backpackItems: gameState.backpackItems.map((item) => groundBackpackItem(item, bpbCache)),
    storageItems: gameState.storageItems.map((item) => groundBackpackItem(item, bpbCache)),
  };
}

export async function analyzeCorrectedState(input: AnalyzeCorrectedStateInput): Promise<AnalysisResult> {
  const { gameState, validation, bpbCache, correctionPromptsUsed } = input;
  const correctionQuestions = buildCorrectionQuestions(
    gameState,
    validation,
    knownGroundedItemNames(bpbCache),
    input.candidateOptionsByField,
  );

  if (correctionQuestions.length > 0) {
    return {
      gameState,
      validation,
      correctionQuestions,
      recommendation: null,
    };
  }

  const groundedState = groundGameState(gameState, bpbCache);

  return {
    gameState: groundedState,
    validation,
    correctionQuestions: [],
    recommendation: recommendNextAction({
      gameState: groundedState,
      bpbCache,
      correctionPromptsUsed,
      itemRecognitionSource: input.itemRecognitionSource,
    }),
  };
}
