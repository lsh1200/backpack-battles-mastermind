export const beginnerPrinciples = [
  "Stick with one main class while learning.",
  "Always maintain a plan A and treat shop decisions as pieces of that plan.",
  "Pivot only when a strong signpost item appears early enough to build around.",
  "Respect shop rarity timing: commons early, rares mostly rounds 4-7, epics from round 6, legendaries after round 7.",
  "Sale items are low-risk because they can usually be sold back for the same price.",
  "Watch stamina pressure when adding weapons.",
  "When low on lives, value short-term tempo over greed.",
] as const;

export const classPlans: Record<string, string[]> = {
  Ranger: [
    "Beginner Ranger likes Hero Sword paths with Broom, Whetstone, and clean aggro tempo.",
    "Broom plus Mana Orb can point toward Magic Staff.",
    "Whetstone plus Ripsaw Blade can point toward Katana.",
  ],
  Reaper: [
    "Beginner Reaper can use Serpent Staff and Cauldron-style control plans once those pieces are grounded.",
  ],
  Berserker: [
    "Beginner Berserker can follow Double Axe with Gloves of Haste and Dragonscale Armor support.",
  ],
  Pyromancer: [
    "Beginner Pyromancer can prioritize Burning Blade with Dancing Dragon and Unidentified Amulet pivots.",
  ],
};

export const genericClassPlans: Record<string, string> = {
  Ranger: "Beginner Ranger should keep a simple tempo plan, watch stamina, and pivot only after grounded signpost items appear.",
  Reaper: "Beginner Reaper should keep a control-oriented plan and wait for grounded shop evidence before naming exact pieces.",
  Berserker: "Beginner Berserker should keep a direct damage plan and avoid adding more weapons than stamina can support.",
  Pyromancer: "Beginner Pyromancer should keep a heat-focused tempo plan and wait for grounded signposts before forcing a pivot.",
};

export const classPlanGroundingItems: Record<string, string[]> = {
  Ranger: ["Hero Sword", "Broom", "Whetstone"],
  Reaper: ["Serpent Staff", "Cauldron"],
  Berserker: ["Double Axe", "Gloves of Haste", "Dragonscale Armor"],
  Pyromancer: ["Burning Blade", "Dancing Dragon", "Unidentified Amulet"],
};
