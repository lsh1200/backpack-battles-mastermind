import type { BpbCache } from "@/lib/bpb/schemas";
import { findBpbItemByName } from "@/lib/bpb/store";
import type { CandidateAction, GameState, Recommendation, ShopItem } from "@/lib/core/types";
import { classPlanGroundingItems, classPlans, genericClassPlans } from "./guide-notes";

type RecommendInput = {
  gameState: GameState;
  bpbCache: BpbCache | null;
  correctionPromptsUsed: string[];
};

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

function ungroundedItemAssumptions(gameState: GameState, bpbCache: BpbCache | null): string[] {
  return [...gameState.shopItems, ...gameState.backpackItems, ...gameState.storageItems]
    .filter((item) => !hasGroundedItem(bpbCache, item.name))
    .map((item) => `${item.name} is not grounded in the local BPB cache; avoid item-specific claims until confirmed.`);
}

export function recommendNextAction(input: RecommendInput): Recommendation {
  const { gameState, bpbCache, correctionPromptsUsed } = input;
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

  const saleItem = gameState.shopItems.find(
    (item) => item.sale && canAfford(item, gameState.gold) && hasGroundedItem(bpbCache, item.name),
  );
  if (saleItem) {
    return {
      bestAction: buyAction(
        saleItem,
        90,
        `Buy ${saleItem.name}: it is on sale, so it is low-risk tempo and can usually be sold back later.`,
      ),
      shortReason: `Buy the sale ${saleItem.name} because sale items are low-risk tempo while you are still learning.`,
      rejectedAlternatives,
      planSupported,
      nextTargets: ["Watch for core plan pieces next shop.", "Avoid rolling below useful gold unless you are chasing a known target."],
      assumptionsMade,
      correctionPromptsUsed,
    };
  }

  if ((gameState.round ?? 1) <= 3 && (gameState.gold ?? 0) <= 2 && gameState.shopItems.length === 0) {
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
      nextTargets: ["Enter the next shop with a clear target.", "Prioritize commons and cheap plan pieces early."],
      assumptionsMade,
      correctionPromptsUsed,
    };
  }

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
    nextTargets: ["Look for plan-defining signpost items.", "Confirm unknown items so advice can become more precise."],
    assumptionsMade,
    correctionPromptsUsed,
  };
}
