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

const RANGER_STARTER_GRID_ORIGIN = { x: 1, y: 2 };

function knownGroundedItemNames(bpbCache: BpbCache | null): string[] {
  return bpbCache?.items.filter((item) => item.grounded).map((item) => item.name) ?? [];
}

function hasDetectedInventoryGrid(validation: ValidationReport): boolean {
  return validation.regions.some(
    (region) =>
      region.name === "inventoryGrid" &&
      region.columns === 9 &&
      region.rows === 7 &&
      region.cellWidth !== undefined &&
      region.cellHeight !== undefined,
  );
}

function isClusterLocalRangerStarter(gameState: GameState, validation: ValidationReport): boolean {
  if (!hasDetectedInventoryGrid(validation)) {
    return false;
  }

  if (gameState.className !== "Ranger" || gameState.bagChoice !== "Ranger Bag") {
    return false;
  }

  const rangerBag = gameState.backpackItems.find((item) => item.name === "Ranger Bag" && item.location === "bag");
  if (rangerBag?.x !== 0 || rangerBag.y !== 0) {
    return false;
  }

  const hasLeatherBag = gameState.backpackItems.some((item) => item.name === "Leather Bag" && item.location === "bag");
  const positionedItems = gameState.backpackItems.filter(
    (item) => item.location === "bag" && item.itemKind !== "bag" && item.x !== undefined && item.y !== undefined,
  );

  return !hasLeatherBag && positionedItems.every((item) => (item.x ?? 0) <= 1 && (item.y ?? 0) <= 2);
}

function normalizeBackpackCoordinatesToInventoryGrid(gameState: GameState, validation: ValidationReport): GameState {
  if (!isClusterLocalRangerStarter(gameState, validation)) {
    return gameState;
  }

  return {
    ...gameState,
    backpackItems: gameState.backpackItems.map((item) => {
      if (item.location !== "bag" || item.x === undefined || item.y === undefined) {
        return item;
      }

      return {
        ...item,
        x: item.x + RANGER_STARTER_GRID_ORIGIN.x,
        y: item.y + RANGER_STARTER_GRID_ORIGIN.y,
      };
    }),
  };
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
  const gridCoordinateState = normalizeBackpackCoordinatesToInventoryGrid(gameState, validation);
  const correctionQuestions = buildCorrectionQuestions(
    gridCoordinateState,
    validation,
    knownGroundedItemNames(bpbCache),
    input.candidateOptionsByField,
  );

  if (correctionQuestions.length > 0) {
    return {
      gameState: gridCoordinateState,
      validation,
      correctionQuestions,
      recommendation: null,
    };
  }

  const groundedState = groundGameState(gridCoordinateState, bpbCache);

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
