import { describe, expect, it } from "vitest";
import { enrichItemFromModalText, mergeEnrichedItem } from "./detail-enricher";
import type { BpbItem } from "./schemas";

describe("BPB detail enrichment", () => {
  it("extracts rarity, type, and effect text from modal text", () => {
    const enriched = enrichItemFromModalText(
      "Hero Sword\nRare\nMelee\nEvery 1.8s: Deal 4-6 damage.\nOn hit: Gain 1 Empower.",
    );

    expect(enriched).toEqual({
      name: "Hero Sword",
      rarity: "Rare",
      type: "Melee",
      effectText: "Every 1.8s: Deal 4-6 damage.\nOn hit: Gain 1 Empower.",
    });
  });

  it("merges details without losing grounded source identity", () => {
    const item: BpbItem = {
      id: 98,
      name: "Hero Sword",
      aliases: ["hero sword", "herosword"],
      imageUrl: "https://awerc.github.io/bpb-cdn/i/HeroSword.webp",
      grounded: true,
      tags: [],
    };

    const merged = mergeEnrichedItem(item, {
      name: "Hero Sword",
      rarity: "Rare",
      type: "Melee",
      effectText: "Every 1.8s: Deal 4-6 damage.",
    });

    expect(merged).not.toBe(item);
    expect(item).not.toHaveProperty("rarity");
    expect(item).not.toHaveProperty("type");
    expect(item).not.toHaveProperty("effectText");
    expect(merged).toMatchObject({
      id: 98,
      name: "Hero Sword",
      rarity: "Rare",
      type: "Melee",
      effectText: "Every 1.8s: Deal 4-6 damage.",
      grounded: true,
    });
  });

  it("does not overwrite existing grounded details with lower-fidelity modal text", () => {
    const item: BpbItem = {
      id: 98,
      name: "Hero Sword",
      aliases: ["hero sword", "herosword"],
      imageUrl: "https://awerc.github.io/bpb-cdn/i/HeroSword.webp",
      rarity: "Epic",
      type: "Melee Weapon",
      effectText: "Canonical BPB catalog effect.",
      grounded: true,
      tags: [],
    };

    const merged = mergeEnrichedItem(item, {
      name: "Hero Sword",
      rarity: "Rare",
      type: "Melee",
      effectText: "Lower fidelity modal effect.",
    });

    expect(merged).toBe(item);
    expect(merged).toMatchObject({
      rarity: "Epic",
      type: "Melee Weapon",
      effectText: "Canonical BPB catalog effect.",
    });
  });

  it("fills only missing details while preserving existing ones", () => {
    const item: BpbItem = {
      id: 98,
      name: "Hero Sword",
      aliases: ["hero sword", "herosword"],
      imageUrl: "https://awerc.github.io/bpb-cdn/i/HeroSword.webp",
      type: "Melee Weapon",
      grounded: true,
      tags: [],
    };

    const merged = mergeEnrichedItem(item, {
      name: "Hero Sword",
      rarity: "Rare",
      type: "Melee",
      effectText: "Every 1.8s: Deal 4-6 damage.",
    });

    expect(merged).not.toBe(item);
    expect(merged).toMatchObject({
      rarity: "Rare",
      type: "Melee Weapon",
      effectText: "Every 1.8s: Deal 4-6 damage.",
    });
  });
});
