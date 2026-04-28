import type { CorrectionQuestion, GameState, ShopItem, ValidationReport } from "@/lib/core/types";

const CLASS_OPTIONS = ["Ranger", "Reaper", "Berserker", "Pyromancer", "Mage", "Adventurer", "Engineer"];
const MANUAL_OPTIONS = ["Correct", "Needs manual edit"];
const UNKNOWN_ITEM = "Unknown Item";

type ItemNameField = {
  collection: "shopItems" | "backpackItems";
  index: number;
};

function parseItemNameField(field: string): ItemNameField | undefined {
  const match = field.match(/^(shopItems|backpackItems)\.(\d+)\.name$/);
  if (!match) {
    return undefined;
  }

  const [, collection, indexText] = match;
  return { collection: collection as ItemNameField["collection"], index: Number(indexText) };
}

function currentItemNameForField(gameState: GameState, field: string): string | undefined {
  const itemField = parseItemNameField(field);
  if (!itemField) {
    return undefined;
  }

  const item =
    itemField.collection === "shopItems" ? gameState.shopItems[itemField.index] : gameState.backpackItems[itemField.index];
  const name = item?.name.trim();

  return name && name !== UNKNOWN_ITEM ? name : undefined;
}

function withCurrentRead(question: string, currentItemName: string | undefined): string {
  return currentItemName ? `${question} Current read: ${currentItemName}.` : question;
}

function itemQuestionText(gameState: GameState, field: string): string {
  const itemField = parseItemNameField(field);
  if (!itemField) {
    return `Confirm ${field}`;
  }

  const currentItemName = currentItemNameForField(gameState, field);

  if (itemField.collection === "shopItems") {
    const item = gameState.shopItems[itemField.index];
    const slot = item?.slot.trim();
    const target = slot ? `shop ${slot}` : `shop item ${itemField.index + 1}`;

    return withCurrentRead(`Choose the item in ${target}.`, currentItemName);
  }

  const item = gameState.backpackItems[itemField.index];
  const location = item?.location && item.location !== "unknown" ? item.location : undefined;
  const area = location ? `backpack ${location}` : "backpack";
  const hasGridPosition = item?.x !== undefined && item.y !== undefined;
  const target = hasGridPosition ? `${area} grid (${item.x}, ${item.y})` : `${area} item ${itemField.index + 1}`;

  return withCurrentRead(`Choose the item in ${target}.`, currentItemName);
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

    if (field === "screenshotQuality") {
      return {
        field,
        question: "Is the screenshot clear enough to read item icons?",
        options: MANUAL_OPTIONS,
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
        question: itemQuestionText(gameState, field),
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

export function applyValidationCorrections(
  validation: ValidationReport,
  corrections: Record<string, string>,
): ValidationReport {
  const confirmedFields = new Set(
    Object.entries(corrections)
      .filter(([, value]) => value === "Correct")
      .map(([field]) => field),
  );

  return {
    ...validation,
    requiresConfirmation: validation.requiresConfirmation.filter((field) => !confirmedFields.has(field)),
  };
}
