import type { BpbCache } from "@/lib/bpb/schemas";
import { findBpbItemByName } from "@/lib/bpb/store";
import type { CandidateAction, GameState, Recommendation, ShopItem } from "@/lib/core/types";
import { classPlanGroundingItems, classPlans, genericClassPlans } from "./guide-notes";

type RecommendInput = {
  gameState: GameState;
  bpbCache: BpbCache | null;
  correctionPromptsUsed: string[];
};

const EARLY_SHOP_PACKAGE_PRIORITY = ["Broom", "Banana", "Stone", "Shiny Shell", "Walrus Tusk"];
const DEFAULT_PLACEMENT_ADVICE = [
  "Keep active weapons in bag space and avoid moving them unless a star bonus clearly improves them.",
  "Before starting battle, check that stamina or support items do not block weapon adjacency.",
];

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

function earlyShopPackagePlacementAdvice(packageItems: ShopItem[]): string[] {
  const itemNames = new Set(packageItems.map((item) => item.name));
  const advice = [];

  if (itemNames.has("Broom")) {
    advice.push("Keep Wooden Sword active and place Broom as the second weapon, not in storage.");
  }

  if (itemNames.has("Stone")) {
    advice.push("Put Stone adjacent to Wooden Sword or Broom so it contributes damage immediately.");
  }

  if (itemNames.has("Banana")) {
    advice.push("Place Banana where it supports stamina without blocking weapon adjacency.");
  }

  if (itemNames.has("Shiny Shell") || itemNames.has("Walrus Tusk")) {
    const extras = ["Shiny Shell", "Walrus Tusk"].filter((itemName) => itemNames.has(itemName)).join(" and ");
    advice.push(`Fit ${extras} only after the weapon and stamina layout is stable.`);
  }

  return advice.length ? advice : DEFAULT_PLACEMENT_ADVICE;
}

function earlyShopPackageAction(
  gameState: GameState,
  bpbCache: BpbCache | null,
): { action: CandidateAction; placementAdvice: string[] } | null {
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
    placementAdvice: earlyShopPackagePlacementAdvice(packageItems),
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
  const earlyPackageAction = earlyShopPackageAction(gameState, bpbCache);

  if (earlyPackageAction) {
    return {
      bestAction: earlyPackageAction.action,
      shortReason: `Buy this shopping sequence now: ${earlyPackageAction.action.target}. It spends your early gold on grounded tempo instead of over-rolling.`,
      rejectedAlternatives,
      planSupported,
      placementAdvice: earlyPackageAction.placementAdvice,
      nextTargets: ["After placement is stable, start battle.", "Next shop, look for Hero Sword and Whetstone lines."],
      assumptionsMade,
      correctionPromptsUsed,
    };
  }

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
      placementAdvice: [
        `After buying ${saleItem.name}, place it only if it improves an active item this round; otherwise keep the core weapon layout stable.`,
        "Check the bought item's stars before battle so the bonus touches the intended weapon or support item.",
      ],
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
      placementAdvice: DEFAULT_PLACEMENT_ADVICE,
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
    placementAdvice: DEFAULT_PLACEMENT_ADVICE,
    nextTargets: ["Look for plan-defining signpost items.", "Confirm unknown items so advice can become more precise."],
    assumptionsMade,
    correctionPromptsUsed,
  };
}
