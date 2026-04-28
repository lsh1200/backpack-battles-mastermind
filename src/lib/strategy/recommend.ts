import type { BpbCache, BpbItem } from "@/lib/bpb/schemas";
import { findBpbItemByName } from "@/lib/bpb/store";
import type { BackpackItem, CandidateAction, GameState, Recommendation, ShopItem } from "@/lib/core/types";
import { optimizePlacement } from "@/lib/placement/optimizer";
import { classPlanGroundingItems, classPlans, genericClassPlans } from "./guide-notes";

type RecommendInput = {
  gameState: GameState;
  bpbCache: BpbCache | null;
  correctionPromptsUsed: string[];
  itemRecognitionSource?: Recommendation["recognitionPolicy"]["itemRecognition"];
};

const EARLY_SHOP_PACKAGE_PRIORITY = ["Broom", "Banana", "Stone", "Shiny Shell", "Walrus Tusk"];

function hasGroundedItem(cache: BpbCache | null, itemName: string): boolean {
  if (cache === null) {
    return false;
  }

  return findBpbItemByName(cache, itemName)?.grounded === true;
}

function visibleItems(gameState: GameState): { name: string; groundedBpbId?: number }[] {
  return [...gameState.shopItems, ...gameState.backpackItems, ...gameState.storageItems];
}

function hasGroundedVisibleItem(gameState: GameState, bpbCache: BpbCache | null, itemName: string): boolean {
  if (bpbCache === null) {
    return false;
  }

  const requiredItem = findBpbItemByName(bpbCache, itemName);
  if (requiredItem?.grounded !== true) {
    return false;
  }

  return visibleItems(gameState).some((visibleItem) => {
    if (visibleItem.groundedBpbId !== undefined) {
      return visibleItem.groundedBpbId === requiredItem.id;
    }

    const visibleBpbItem = findBpbItemByName(bpbCache, visibleItem.name);
    return visibleBpbItem?.grounded === true && visibleBpbItem.id === requiredItem.id;
  });
}

function planForClass(gameState: GameState, bpbCache: BpbCache | null): string {
  const className = gameState.className;
  const genericPlan = genericClassPlans[className] ?? "Keep the current plan stable while collecting grounded information.";
  const requiredItems = classPlanGroundingItems[className] ?? [];

  if (requiredItems.some((itemName) => !hasGroundedVisibleItem(gameState, bpbCache, itemName))) {
    return genericPlan;
  }

  return classPlans[className]?.[0] ?? "Keep the current plan stable while collecting grounded information.";
}

function canAfford(item: ShopItem, gold: number | null): boolean {
  return item.price !== undefined && gold !== null && item.price <= gold;
}

function buyAction(item: ShopItem, value: number, teachingReason: string): CandidateAction {
  return {
    type: "buy",
    target: item.name,
    value,
    risks: item.sale ? [] : ["Spending gold reduces roll flexibility this round."],
    assumptions: [],
    teachingReason,
  };
}

function earlyShopPackageAction(
  gameState: GameState,
  bpbCache: BpbCache | null,
): { action: CandidateAction; targetItems: string[] } | null {
  if ((gameState.round ?? 99) > 2 || gameState.gold === null) {
    return null;
  }

  let remainingGold = gameState.gold;
  const packageItems: ShopItem[] = [];

  for (const itemName of EARLY_SHOP_PACKAGE_PRIORITY) {
    const item = gameState.shopItems.find(
      (shopItem) => shopItem.name === itemName && hasGroundedItem(bpbCache, shopItem.name),
    );
    if (item?.price === undefined || item.price > remainingGold) {
      continue;
    }

    packageItems.push(item);
    remainingGold -= item.price;
  }

  if (packageItems.length < 2) {
    return null;
  }

  const target = packageItems.map((item) => item.name).join(", ");
  const spentGold = gameState.gold - remainingGold;
  const spendText =
    remainingGold === 0 ? `uses all ${spentGold} gold` : `uses ${spentGold} of your ${gameState.gold} gold`;

  return {
    action: {
      type: "buy",
      target,
      value: 95,
      risks: ["Check backpack space before buying every piece; put extras in storage if needed."],
      assumptions: [],
      teachingReason: `Buy ${target}: this round-one shopping sequence ${spendText} to add a second weapon, stamina support, and cheap tempo pieces.`,
    },
    targetItems: packageItems.map((item) => item.name),
  };
}

function recognitionPolicy(
  assumptionsMade: string[],
  source: Recommendation["recognitionPolicy"]["itemRecognition"] | undefined,
): Recommendation["recognitionPolicy"] {
  if (source === "llm-fallback") {
    return {
      itemRecognition: "llm-fallback",
      summary:
        "This result used an LLM fallback/audit path for screen reading. BPB grounding still gates item facts, but confirm item names and positions when precision matters.",
      warnings: assumptionsMade,
    };
  }

  if (source === "user-confirmed") {
    return {
      itemRecognition: "user-confirmed",
      summary: "Item names came from user-confirmed correction data and were grounded against the local BPB cache before recommendation.",
      warnings: assumptionsMade,
    };
  }

  if (assumptionsMade.length === 0) {
    return {
      itemRecognition: source === "local-first" ? "local-first" : "mixed",
      summary: "Item names used for advice are grounded against the local BPB cache before recommendation; the LLM is not treated as item authority.",
      warnings: [],
    };
  }

  return {
    itemRecognition: "mixed",
    summary:
      "Some visible item names are not grounded locally yet. Treat item-specific advice as provisional until the recognizer or user confirmation resolves them.",
    warnings: assumptionsMade,
  };
}

function ungroundedItemAssumptions(gameState: GameState, bpbCache: BpbCache | null): string[] {
  return [...gameState.shopItems, ...gameState.backpackItems, ...gameState.storageItems]
    .filter((item) => !hasGroundedItem(bpbCache, item.name))
    .map((item) => `${item.name} is not grounded in the local BPB cache; avoid item-specific claims until confirmed.`);
}

function footprintCellsFromShape(shape: BpbItem["shape"]): NonNullable<BackpackItem["footprint"]>["cells"] {
  return (shape ?? []).flatMap((row, y) =>
    row.flatMap((value, x) => (value === 1 ? [{ x, y }] : [])),
  );
}

function itemShapesByName(itemNames: string[], bpbCache: BpbCache | null): Record<string, number[][]> {
  if (!bpbCache) {
    return {};
  }

  return Object.fromEntries(
    itemNames.flatMap((itemName) => {
      const item = findBpbItemByName(bpbCache, itemName);
      return item?.grounded && item.shape ? [[itemName, item.shape] as const] : [];
    }),
  );
}

function withBpbPlacementMetadata(item: BackpackItem, bpbCache: BpbCache | null): BackpackItem {
  const bpbItem = bpbCache ? findBpbItemByName(bpbCache, item.name) : undefined;
  if (!bpbItem?.grounded) {
    return item;
  }

  const footprintCells = item.footprint ? [] : footprintCellsFromShape(bpbItem.shape);
  const itemKind = item.itemKind ?? (bpbItem.type === "Bag" ? "bag" : undefined);

  return {
    ...item,
    ...(itemKind ? { itemKind } : {}),
    ...(item.footprint
      ? {}
      : footprintCells.length > 0
        ? { footprint: { source: "local-data" as const, cells: footprintCells } }
        : {}),
  };
}

function gameStateWithBpbPlacementMetadata(gameState: GameState, bpbCache: BpbCache | null): GameState {
  return {
    ...gameState,
    backpackItems: gameState.backpackItems.map((item) => withBpbPlacementMetadata(item, bpbCache)),
    storageItems: gameState.storageItems.map((item) => withBpbPlacementMetadata(item, bpbCache)),
  };
}

export function recommendNextAction(input: RecommendInput): Recommendation {
  const { gameState, bpbCache, correctionPromptsUsed, itemRecognitionSource } = input;
  const assumptionsMade = ungroundedItemAssumptions(gameState, bpbCache);
  const rejectedAlternatives: CandidateAction[] = gameState.shopItems
    .filter((item) => item.sale && (!canAfford(item, gameState.gold) || !hasGroundedItem(bpbCache, item.name)))
    .map((item) => {
      const affordable = canAfford(item, gameState.gold);
      const grounded = hasGroundedItem(bpbCache, item.name);
      const risks = [
        ...(affordable ? [] : ["Current gold or listed item price is not enough to confirm affordability."]),
        ...(grounded ? [] : ["Item is not grounded in the local BPB cache."]),
      ];

      return {
        type: "buy",
        target: item.name,
        value: 20,
        risks,
        assumptions: [],
        teachingReason: `Skip ${item.name}: ${risks.join(" ")}`,
      };
    });
  const planSupported = planForClass(gameState, bpbCache);
  const earlyPackageAction = earlyShopPackageAction(gameState, bpbCache);
  const itemRecognitionPolicy = recognitionPolicy(assumptionsMade, itemRecognitionSource);

  if (earlyPackageAction) {
    const placementState = gameStateWithBpbPlacementMetadata(gameState, bpbCache);
    const placementPlan = optimizePlacement({
      gameState: placementState,
      targetItems: earlyPackageAction.targetItems,
      itemShapes: itemShapesByName(
        [...placementState.backpackItems.map((item) => item.name), ...earlyPackageAction.targetItems],
        bpbCache,
      ),
    });

    return {
      bestAction: earlyPackageAction.action,
      shortReason: `Buy this shopping sequence now: ${earlyPackageAction.action.target}. It spends your early gold on grounded tempo instead of over-rolling.`,
      rejectedAlternatives,
      planSupported,
      ...placementPlan,
      recognitionPolicy: itemRecognitionPolicy,
      nextTargets: ["After placement is stable, start battle.", "Next shop, look for Hero Sword and Whetstone lines."],
      assumptionsMade,
      correctionPromptsUsed,
    };
  }

  const saleItem = gameState.shopItems.find(
    (item) => item.sale && canAfford(item, gameState.gold) && hasGroundedItem(bpbCache, item.name),
  );
  if (saleItem) {
    const placementState = gameStateWithBpbPlacementMetadata(gameState, bpbCache);
    const placementPlan = optimizePlacement({
      gameState: placementState,
      targetItems: [saleItem.name],
      itemShapes: itemShapesByName([...placementState.backpackItems.map((item) => item.name), saleItem.name], bpbCache),
    });

    return {
      bestAction: buyAction(
        saleItem,
        90,
        `Buy ${saleItem.name}: it is on sale, so it is low-risk tempo and can usually be sold back later.`,
      ),
      shortReason: `Buy the sale ${saleItem.name} because sale items are low-risk tempo while you are still learning.`,
      rejectedAlternatives,
      planSupported,
      ...placementPlan,
      recognitionPolicy: itemRecognitionPolicy,
      nextTargets: ["Watch for core plan pieces next shop.", "Avoid rolling below useful gold unless you are chasing a known target."],
      assumptionsMade,
      correctionPromptsUsed,
    };
  }

  if ((gameState.round ?? 1) <= 3 && (gameState.gold ?? 0) <= 2 && gameState.shopItems.length === 0) {
    const placementState = gameStateWithBpbPlacementMetadata(gameState, bpbCache);
    const placementPlan = optimizePlacement({
      gameState: placementState,
      targetItems: [],
      itemShapes: itemShapesByName(placementState.backpackItems.map((item) => item.name), bpbCache),
    });

    return {
      bestAction: {
        type: "start-battle",
        target: "current board",
        value: 60,
        risks: ["You may miss a shop improvement, but low gold makes rolling weak."],
        assumptions: [],
        teachingReason: "Early rounds are tempo-sensitive. With little gold left, rolling is unlikely to find a specific plan piece.",
      },
      shortReason: "Preserve tempo and start the battle instead of spending your last gold on weak early rolls.",
      rejectedAlternatives,
      planSupported,
      ...placementPlan,
      recognitionPolicy: itemRecognitionPolicy,
      nextTargets: ["Enter the next shop with a clear target.", "Prioritize commons and cheap plan pieces early."],
      assumptionsMade,
      correctionPromptsUsed,
    };
  }

  const placementState = gameStateWithBpbPlacementMetadata(gameState, bpbCache);
  const placementPlan = optimizePlacement({
    gameState: placementState,
    targetItems: [],
    itemShapes: itemShapesByName(placementState.backpackItems.map((item) => item.name), bpbCache),
  });

  return {
    bestAction: {
      type: "start-battle",
      target: "current board",
      value: 50,
      risks: ["This is a safe default because no higher-value grounded action was found."],
      assumptions: assumptionsMade,
      teachingReason: "When no grounded shop action is clearly better, keep tempo and gather more information next round.",
    },
    shortReason: "No grounded buy or pivot is clearly better, so keep tempo and continue the current plan.",
    rejectedAlternatives,
    planSupported,
    ...placementPlan,
    recognitionPolicy: itemRecognitionPolicy,
    nextTargets: ["Look for plan-defining signpost items.", "Confirm unknown items so advice can become more precise."],
    assumptionsMade,
    correctionPromptsUsed,
  };
}
