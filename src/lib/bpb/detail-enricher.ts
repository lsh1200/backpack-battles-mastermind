import type { BpbItem } from "./schemas";

const KNOWN_RARITIES = new Set(["Common", "Rare", "Epic", "Legendary", "Godly", "Unique"]);

export type BpbItemDetails = {
  name: string;
  rarity?: string;
  type?: string;
  effectText?: string;
};

export function enrichItemFromModalText(text: string): BpbItemDetails {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const name = lines[0] ?? "";
  const rarityIndex = lines.findIndex((line) => KNOWN_RARITIES.has(line));
  const rarity = rarityIndex >= 0 ? lines[rarityIndex] : undefined;
  const type = rarityIndex >= 0 ? lines[rarityIndex + 1] : undefined;
  const effectText = rarityIndex >= 0 ? lines.slice(rarityIndex + 2).join("\n") : undefined;

  return {
    name,
    ...(rarity ? { rarity } : {}),
    ...(type ? { type } : {}),
    ...(effectText ? { effectText } : {}),
  };
}

function hasText(value: string | undefined): boolean {
  return value !== undefined && value.trim().length > 0;
}

export function mergeEnrichedItem(item: BpbItem, details: BpbItemDetails): BpbItem {
  if (item.name !== details.name) {
    return item;
  }

  const updates = {
    ...(!hasText(item.rarity) && details.rarity ? { rarity: details.rarity } : {}),
    ...(!hasText(item.type) && details.type ? { type: details.type } : {}),
    ...(!hasText(item.effectText) && details.effectText ? { effectText: details.effectText } : {}),
  };

  if (Object.keys(updates).length === 0) {
    return item;
  }

  return {
    ...item,
    ...updates,
  };
}
