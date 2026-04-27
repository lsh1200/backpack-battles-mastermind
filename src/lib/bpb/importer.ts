import * as cheerio from "cheerio";
import type { BpbBuild, BpbItem } from "./schemas";

const BPB_CDN_PREFIX = "https://awerc.github.io/bpb-cdn/";
const BPB_ITEM_IMAGE_PREFIX = `${BPB_CDN_PREFIX}i/`;
const CATALOG_XOR_KEY = "cb0f3e4a-56b8-449b-8441-88aab8d1127b";
const CATALOG_FIELDS = [
  "accuracy",
  "cd",
  "cost",
  "damage",
  "effect",
  "extraTypes",
  "gid",
  "name",
  "rarity",
  "shape",
  "stamina",
  "type",
  "sockets",
  "extraShapes",
  "class",
  "colOffset",
  "height",
  "rowOffset",
  "width",
  "is_beta",
] as const;
const CLASS_ITEMS_BY_CLASS: Record<string, string[]> = {
  Adventurer: ["Bag of Giving", "Fedora", "Mercury Elemental", "Scale", "Sewing Case", "Turtle", "Ukulele"],
  Berserker: [
    "Anvil",
    "Brass Knuckles",
    "Deerwood Guardian",
    "Duffle Bag",
    "Shaman Mask",
    "Utility Pouch",
    "Wolf Emblem",
  ],
  Engineer: ["Box of Cogs", "Hypercube", "Laboratory", "Mana Crystal", "Mecha Armor", "Port-o-Charger", "Tesla Coil"],
  Mage: ["Harold, the Hateful Hat", "Puzzlebox", "Rainbow Potion", "Scholar Bag", "Shiny Mantle", "Spirit Bells", "Water Elemental"],
  Pyromancer: [
    "Burning Banner",
    "Dark Lantern",
    "Dragon Nest",
    "Fire Pit",
    "Friendly Fire",
    "Frozen Flame",
    "Offering Bowl",
  ],
  Ranger: ["Big Bowl of Treats", "Mega Clover", "Piercing Arrow", "Poison Ivy", "Ranger Bag", "Vineweave Basket", "Yggdrasil Leaf"],
  Reaper: ["Cauldron", "Cursed Dagger", "Mr. Struggles", "Nocturnal Lock Lifter", "Relic Case", "Snake", "Storage Coffin"],
};
const CLASS_BY_ITEM_NAME = new Map(
  Object.entries(CLASS_ITEMS_BY_CLASS).flatMap(([className, items]) =>
    items.map((itemName) => [normalizeItemName(itemName), className] as const),
  ),
);

export type BpbCatalogItem = {
  gid: number;
  name: string;
  src?: string;
  rarity?: string;
  type?: string;
  class?: string;
  cost?: number;
  effect?: string;
  extraTypes?: string[];
  shape?: number[][];
};

export type BpbCatalog = {
  patchVersion: string | null;
  patchDate: string | null;
  items: BpbCatalogItem[];
};

export type BpbBuildPage = {
  builds: BpbBuild[];
  total: number;
  offset: number;
  limit: number;
};

export function normalizeItemName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, " ")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function extractScriptUrlsFromHtml(html: string, baseUrl: string): string[] {
  const base = new URL(baseUrl);

  return Array.from(html.matchAll(/src="([^"]+\.js)"/g), (match) => new URL(match[1], base).toString()).filter(
    (url, index, urls) => {
      const parsed = new URL(url);
      return parsed.origin === base.origin && parsed.pathname.startsWith("/_next/static/chunks/") && urls.indexOf(url) === index;
    },
  );
}

function compactAliasFromImage(url: string): string | null {
  const match = url.match(/\/([^/]+)\.webp(?:$|\?)/i);
  return match ? match[1].toLowerCase() : null;
}

function resolveItemImageUrl(src: string): string | null {
  const imageUrl = src.startsWith("http") ? src : `${BPB_CDN_PREFIX}${src.replace(/^\/+/, "")}`;
  return imageUrl.startsWith(BPB_ITEM_IMAGE_PREFIX) && /\.webp(?:$|\?)/i.test(imageUrl) ? imageUrl : null;
}

function compactImagePathFromName(name: string): string {
  return `/i/${name.replace(/\W/g, "")}.webp`;
}

function catalogImageUrl(item: BpbCatalogItem): string {
  const src = item.src ?? compactImagePathFromName(item.name);
  return src.startsWith("http") ? src : `${BPB_CDN_PREFIX}${src.replace(/^\/+/, "")}`;
}

function catalogLookup(catalogItems: BpbCatalogItem[]): Map<string, BpbCatalogItem> {
  const lookup = new Map<string, BpbCatalogItem>();

  for (const item of catalogItems) {
    lookup.set(normalizeItemName(item.name), item);
    lookup.set(catalogImageUrl(item).toLowerCase(), item);
  }

  return lookup;
}

function gridDimension(shape: number[][] | undefined, axis: "width" | "height"): number | undefined {
  if (!shape?.length) {
    return undefined;
  }

  return axis === "height" ? shape.length : Math.max(...shape.map((row) => row.length));
}

function itemClassName(name: string, catalogItem: BpbCatalogItem | undefined): string {
  if (typeof catalogItem?.class === "string") {
    return catalogItem.class;
  }

  return CLASS_BY_ITEM_NAME.get(normalizeItemName(name)) ?? "Neutral";
}

export function extractItemIndexFromItemsHtml(html: string, catalogItems: BpbCatalogItem[] = []): BpbItem[] {
  const $ = cheerio.load(html);
  const seen = new Map<string, BpbItem>();
  const catalog = catalogLookup(catalogItems);

  $("img").each((_, element) => {
    const alt = $(element).attr("alt")?.replace(/^Image:\s*/i, "").trim();
    const src = $(element).attr("src") || $(element).parent("a").attr("href");
    const imageUrl = src ? resolveItemImageUrl(src) : null;

    if (!alt || !imageUrl) {
      return;
    }

    const normalized = normalizeItemName(alt);
    const compact = compactAliasFromImage(imageUrl);
    const aliases = Array.from(new Set([normalized, compact].filter(Boolean) as string[]));
    const catalogItem = catalog.get(normalized) ?? catalog.get(imageUrl.toLowerCase());
    const className = itemClassName(alt, catalogItem);

    if (!seen.has(normalized)) {
      seen.set(normalized, {
        id: catalogItem?.gid ?? seen.size,
        ...(catalogItem ? { gid: catalogItem.gid } : {}),
        name: alt,
        aliases,
        imageUrl,
        className,
        ...(catalogItem?.rarity ? { rarity: catalogItem.rarity } : {}),
        ...(catalogItem?.type ? { type: catalogItem.type } : {}),
        ...(catalogItem?.cost !== undefined ? { cost: catalogItem.cost } : {}),
        ...(catalogItem?.effect !== undefined ? { effectText: catalogItem.effect } : {}),
        ...(catalogItem?.shape ? { shape: catalogItem.shape } : {}),
        ...(gridDimension(catalogItem?.shape, "width") ? { gridWidth: gridDimension(catalogItem?.shape, "width") } : {}),
        ...(gridDimension(catalogItem?.shape, "height") ? { gridHeight: gridDimension(catalogItem?.shape, "height") } : {}),
        grounded: true,
        tags: catalogItem?.extraTypes ?? [],
      });
    }
  });

  return Array.from(seen.values());
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function parseItemIds(value: unknown): number[] {
  if (Array.isArray(value)) {
    return value.flatMap(parseItemIds);
  }

  if (typeof value === "number" && Number.isInteger(value) && value >= 0) {
    return [value];
  }

  if (typeof value === "string") {
    return (value.match(/\d+/g) ?? []).map(Number).filter((itemId) => Number.isInteger(itemId) && itemId >= 0);
  }

  const record = asRecord(value);
  const gid = optionalNumber(record.gid);
  if (gid !== undefined && Number.isInteger(gid) && gid >= 0) {
    return [gid];
  }

  return [];
}

function uniqueNumbers(values: number[]): number[] {
  return Array.from(new Set(values));
}

export function normalizeBuildsPage(payload: unknown): BpbBuildPage {
  const record = asRecord(payload);
  const pagination = asRecord(record.pagination);
  const data = Array.isArray(record.data) ? record.data : [];

  const builds = data.map((build) => {
    const value = asRecord(build);
    const buildId = optionalNumber(value.id);
    const tiers = (Array.isArray(value.tiers) ? value.tiers : []).map((tier) => {
      const tierRecord = asRecord(tier);
      return {
        color: nullableString(tierRecord.color),
        title: nullableString(tierRecord.title),
        itemIds: parseItemIds(tierRecord.items),
      };
    });
    const snapshots = Array.isArray(value.snapshots) ? value.snapshots : [];
    const normalizedSnapshots = snapshots.map((snapshot) => {
      const snapshotRecord = asRecord(snapshot);
      return {
        order: optionalNumber(snapshotRecord.order) ?? 0,
        buildId: optionalNumber(snapshotRecord.buildId) ?? buildId ?? 0,
        name: nullableString(snapshotRecord.name),
        itemIds: parseItemIds(snapshotRecord.items),
      };
    });
    const itemIds = uniqueNumbers([
      ...tiers.flatMap((tier) => tier.itemIds),
      ...normalizedSnapshots.flatMap((snapshot) => snapshot.itemIds),
    ]);
    const author = asRecord(value.author);

    return {
      id: buildId ?? 0,
      title: nullableString(value.title) ?? "Untitled build",
      description: nullableString(value.description),
      className: nullableString(value.class),
      subclass: nullableString(value.subclass),
      bag: nullableString(value.bag),
      difficulty: nullableString(value.difficulty),
      createdAt: nullableString(value.createdAt),
      updatedAt: nullableString(value.updatedAt),
      totalRating: optionalNumber(value.totalRating) ?? null,
      views: optionalNumber(value.views) ?? null,
      commentsCount: optionalNumber(value.commentsCount) ?? null,
      tiers,
      author:
        author.id || author.name
          ? {
              id: nullableString(author.id),
              name: nullableString(author.name),
              image: nullableString(author.image),
              rating: optionalNumber(author.rating) ?? null,
            }
          : null,
      snapshotCount: normalizedSnapshots.length,
      snapshots: normalizedSnapshots,
      itemIds,
    };
  });

  return {
    builds,
    total: optionalNumber(pagination.total) ?? builds.length,
    offset: optionalNumber(pagination.offset) ?? 0,
    limit: optionalNumber(pagination.limit) ?? builds.length,
  };
}

export function normalizeBuildsPayload(payload: unknown): BpbBuild[] {
  return normalizeBuildsPage(payload).builds;
}

export function attachBuildReferencesToItems(items: BpbItem[], builds: BpbBuild[]): BpbItem[] {
  const refsByItemId = new Map<number, number[]>();

  for (const build of builds) {
    for (const itemId of build.itemIds) {
      refsByItemId.set(itemId, [...(refsByItemId.get(itemId) ?? []), build.id]);
    }
  }

  return items.map((item) => ({
    ...item,
    publicBuildIds: uniqueNumbers(refsByItemId.get(item.id) ?? []),
  }));
}

function decodeCatalogDatabase(encoded: string): unknown {
  const data = Buffer.from(encoded, "base64");
  const decoded = Buffer.alloc(data.length);

  for (let index = 0; index < data.length; index += 1) {
    decoded[index] = data[index] ^ CATALOG_XOR_KEY.charCodeAt(index % CATALOG_XOR_KEY.length);
  }

  try {
    return JSON.parse(decoded.toString("utf8")) as unknown;
  } catch (error) {
    throw new Error("Invalid BPB client catalog payload", { cause: error });
  }
}

function catalogItemFromRow(row: unknown): BpbCatalogItem | null {
  if (!Array.isArray(row)) {
    return null;
  }

  const record = row.reduce<Record<string, unknown>>((item, value, index) => {
    const field = CATALOG_FIELDS[index];
    return value !== null && value !== undefined && field ? { ...item, [field]: value } : item;
  }, {});

  const gid = typeof record.gid === "number" && Number.isInteger(record.gid) && record.gid >= 0 ? record.gid : null;

  if (gid === null || typeof record.name !== "string") {
    return null;
  }

  return {
    gid,
    name: record.name,
    src: compactImagePathFromName(record.name),
    ...(typeof record.rarity === "string" ? { rarity: record.rarity } : {}),
    ...(typeof record.type === "string" ? { type: record.type } : {}),
    ...(typeof record.class === "string" ? { class: record.class } : {}),
    ...(typeof record.cost === "number" ? { cost: record.cost } : {}),
    ...(typeof record.effect === "string" ? { effect: record.effect } : {}),
    ...(Array.isArray(record.extraTypes) && record.extraTypes.every((tag) => typeof tag === "string")
      ? { extraTypes: record.extraTypes }
      : {}),
    ...(Array.isArray(record.shape) ? { shape: record.shape as number[][] } : {}),
  };
}

export function extractBpbCatalogFromClientChunks(chunks: string[]): BpbCatalog {
  const databaseChunk = chunks.find((chunk) => chunk.includes("DB:()=>R"));
  const encodedMatch = databaseChunk?.match(/let R="([^"]+)"/);
  const patchMatch = chunks.join("").match(/let i=\[\{version:"([^"]+)",date:"([^"]+)",type:"([^"]+)"/);

  if (!encodedMatch) {
    throw new Error("Could not find BPB item catalog in client chunks");
  }

  const decoded = decodeCatalogDatabase(encodedMatch[1]);
  const rows = Array.isArray(decoded) ? decoded : [];
  const items = rows.flatMap((row) => {
    const item = catalogItemFromRow(row);
    return item ? [item] : [];
  });

  if (items.length === 0) {
    throw new Error("BPB item catalog did not contain usable gids");
  }

  return {
    patchVersion: patchMatch?.[1] ?? null,
    patchDate: patchMatch?.[2] ?? null,
    items,
  };
}
