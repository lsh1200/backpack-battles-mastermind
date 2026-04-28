import type { CorrectionQuestion, GameState, ShopItem, ValidationReport } from "@/lib/core/types";

const CLASS_OPTIONS = ["Ranger", "Reaper", "Berserker", "Pyromancer", "Mage", "Adventurer", "Engineer"];
const MANUAL_OPTIONS = ["Correct", "Needs manual edit"];
const UNKNOWN_ITEM = "Unknown Item";

function currentItemNameForField(gameState: GameState, field: string): string | undefined {
  const match = field.match(/^(shopItems|backpackItems)\.(\d+)\.name$/);
  if (!match) {
    return undefined;
  }

  const [, collection, indexText] = match;
  const index = Number(indexText);
  const item = collection === "shopItems" ? gameState.shopItems[index] : gameState.backpackItems[index];
  const name = item?.name.trim();

  return name && name !== UNKNOWN_ITEM ? name : undefined;
}

export function buildCorrectionQuestions(
  gameState: GameState,
  validation: ValidationReport,
  knownItemNames: string[],
  candidateOptionsByField: Record<string, string[]> = {},
): CorrectionQuestion[] {
  const fields = Array.from(new Set([...gameState.uncertainFields, ...validation.requiresConfirmation]));

  return fields.map((field) => {
    if (field === "className") {
      return {
        field,
        question: "Which class are you playing?",
        options: CLASS_OPTIONS,
      };
    }

    if ((field.startsWith("shopItems.") || field.startsWith("backpackItems.")) && field.endsWith(".name")) {
      const candidateOptions = candidateOptionsByField[field] ?? [];
      const currentItemName = currentItemNameForField(gameState, field);
      const currentItemOptions = currentItemName && (candidateOptions.length > 0 || knownItemNames.length > 0) ? [currentItemName] : [];
      const optionPriority = field.startsWith("backpackItems.")
        ? [...candidateOptions, ...currentItemOptions, ...knownItemNames]
        : [...candidateOptions, ...knownItemNames, ...currentItemOptions];
      const options = Array.from(new Set(optionPriority)).slice(0, 12);

      return {
        field,
        question: field.startsWith("shopItems.") ? "Which shop item is this?" : "Which backpack item is this?",
        options: options.length > 0 ? options : ["Needs manual edit"],
      };
    }

    return {
      field,
      question: `Confirm ${field}`,
      options: MANUAL_OPTIONS,
    };
  });
}

function correctedShopItems(shopItems: ShopItem[], corrections: Record<string, string>): ShopItem[] {
  return shopItems.map((item, index) => {
    const correctedName = nonBlankCorrection(corrections[`shopItems.${index}.name`]);
    return correctedName === undefined ? item : { ...item, name: correctedName };
  });
}

function correctedBackpackItems(gameState: GameState, corrections: Record<string, string>): GameState["backpackItems"] {
  return gameState.backpackItems.map((item, index) => {
    const correctedName = nonBlankCorrection(corrections[`backpackItems.${index}.name`]);
    return correctedName === undefined ? item : { ...item, name: correctedName };
  });
}

function nonBlankCorrection(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function appliedCorrectionFields(gameState: GameState, corrections: Record<string, string>): Set<string> {
  const fields = new Set<string>();

  if (nonBlankCorrection(corrections.className) !== undefined) {
    fields.add("className");
  }

  gameState.shopItems.forEach((_, index) => {
    const field = `shopItems.${index}.name`;
    if (nonBlankCorrection(corrections[field]) !== undefined) {
      fields.add(field);
    }
  });

  gameState.backpackItems.forEach((_, index) => {
    const field = `backpackItems.${index}.name`;
    if (nonBlankCorrection(corrections[field]) !== undefined) {
      fields.add(field);
    }
  });

  return fields;
}

export function applyCorrections(gameState: GameState, corrections: Record<string, string>): GameState {
  const appliedFields = appliedCorrectionFields(gameState, corrections);

  return {
    ...gameState,
    className: nonBlankCorrection(corrections.className) ?? gameState.className,
    shopItems: correctedShopItems(gameState.shopItems, corrections),
    backpackItems: correctedBackpackItems(gameState, corrections),
    uncertainFields: gameState.uncertainFields.filter((field) => !appliedFields.has(field)),
  };
}
