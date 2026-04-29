import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  attachBuildReferencesToItems,
  extractBpbCatalogFromClientChunks,
  extractItemIndexFromItemsHtml,
  extractScriptUrlsFromHtml,
  normalizeBuildsPage,
  normalizeBuildsPayload,
  normalizeItemName,
} from "./importer";

const fixturePath = (...parts: string[]) => join(process.cwd(), "tests", "fixtures", ...parts);

describe("BPB importer", () => {
  it("normalizes item names into stable aliases", () => {
    expect(normalizeItemName("Hero Sword")).toBe("hero sword");
    expect(normalizeItemName("Maneki-neko")).toBe("maneki neko");
  });

  it("extracts item names and images from the BPB items page", async () => {
    const html = await readFile(fixturePath("bpb", "items-page.sample.html"), "utf8");
    const items = extractItemIndexFromItemsHtml(html);

    expect(items).toEqual([
      {
        id: 0,
        name: "Wooden Sword",
        aliases: ["wooden sword", "woodensword"],
        imageUrl: "https://awerc.github.io/bpb-cdn/i/WoodenSword.webp",
        className: "Neutral",
        grounded: true,
        tags: [],
      },
      {
        id: 1,
        name: "Broom",
        aliases: ["broom"],
        imageUrl: "https://awerc.github.io/bpb-cdn/i/Broom.webp",
        className: "Neutral",
        grounded: true,
        tags: [],
      },
      {
        id: 2,
        name: "Hero Sword",
        aliases: ["hero sword", "herosword"],
        imageUrl: "https://awerc.github.io/bpb-cdn/i/HeroSword.webp",
        className: "Neutral",
        grounded: true,
        tags: [],
      },
    ]);
  });

  it("uses BPB catalog gids and metadata when available", async () => {
    const html = await readFile(fixturePath("bpb", "items-page.sample.html"), "utf8");
    const items = extractItemIndexFromItemsHtml(html, [
      {
        gid: 1,
        name: "Wooden Sword",
        src: "/i/WoodenSword.webp",
        rarity: "Common",
        type: "Melee Weapon",
        effect: "",
        shape: [[1], [1]],
      },
      {
        gid: 3,
        name: "Broom",
        src: "/i/Broom.webp",
        rarity: "Common",
        type: "Melee Weapon",
        effect: "Opponent misses attack: gain damage.",
        shape: [[0, 1], [0, 1], [0, 1], [0, 1]],
      },
      {
        gid: 29,
        name: "Hero Sword",
        src: "/i/HeroSword.webp",
        rarity: "Epic",
        type: "Melee Weapon",
        effect: "Empowers weapons in front.",
        shape: [[1], [1]],
      },
    ]);

    expect(items.map((item) => [item.name, item.id, item.gid])).toEqual([
      ["Wooden Sword", 1, 1],
      ["Broom", 3, 3],
      ["Hero Sword", 29, 29],
    ]);
    expect(items[1]).toMatchObject({
      className: "Neutral",
      rarity: "Common",
      type: "Melee Weapon",
      effectText: "Opponent misses attack: gain damage.",
      gridHeight: 4,
      gridWidth: 2,
    });
  });

  it("infers exact item classes for class-owned BPB items", () => {
    const items = extractItemIndexFromItemsHtml(
      `<img alt="Ranger Bag" src="https://awerc.github.io/bpb-cdn/i/RangerBag.webp" />`,
      [{ gid: 67, name: "Ranger Bag", src: "/i/RangerBag.webp", rarity: "Unique", type: "Bag" }],
    );

    expect(items[0]).toMatchObject({
      className: "Ranger",
      id: 67,
      gid: 67,
    });
  });

  it("normalizes public build payloads", async () => {
    const json = JSON.parse(await readFile(fixturePath("bpb", "builds.sample.json"), "utf8"));
    const builds = normalizeBuildsPayload(json);

    expect(builds).toHaveLength(1);
    expect(builds[0]).toMatchObject({
      id: 3418,
      title: "empower spike berserker",
      className: "Berserker",
      subclass: "Wolf Emblem",
      bag: "Duffle Bag",
      difficulty: "Easy",
      itemIds: [42, 44, 98],
      tiers: [{ color: "#FF7F7F", itemIds: [42, 44, 98], title: "S" }],
      author: { id: "91AsU6", name: "iAngle" },
      snapshotCount: 1,
      snapshots: [{ order: 0, buildId: 3418, name: null, itemIds: [42, 98] }],
    });
  });

  it("normalizes build page pagination metadata", async () => {
    const json = JSON.parse(await readFile(fixturePath("bpb", "builds.sample.json"), "utf8"));
    const page = normalizeBuildsPage(json);

    expect(page.total).toBe(1);
    expect(page.limit).toBe(20);
    expect(page.offset).toBe(0);
    expect(page.builds[0].itemIds).toEqual([42, 44, 98]);
  });

  it("attaches item-level public build references", async () => {
    const html = await readFile(fixturePath("bpb", "items-page.sample.html"), "utf8");
    const items = extractItemIndexFromItemsHtml(html, [
      { gid: 1, name: "Wooden Sword", src: "/i/WoodenSword.webp" },
      { gid: 3, name: "Broom", src: "/i/Broom.webp" },
      { gid: 29, name: "Hero Sword", src: "/i/HeroSword.webp" },
    ]);
    const enriched = attachBuildReferencesToItems(items, [
      {
        id: 3418,
        title: "empower spike berserker",
        className: "Berserker",
        subclass: "Wolf Emblem",
        bag: "Duffle Bag",
        difficulty: "Easy",
        updatedAt: "2026-04-26T06:41:08.472+00:00",
        itemIds: [1, 29],
        tiers: [],
        author: null,
        snapshotCount: 1,
      },
      {
        id: 3419,
        title: "broom pivot",
        className: "Ranger",
        subclass: null,
        bag: null,
        difficulty: null,
        updatedAt: null,
        itemIds: [3, 29],
        tiers: [],
        author: null,
        snapshotCount: 0,
      },
    ]);

    expect(enriched.find((item) => item.name === "Hero Sword")?.publicBuildIds).toEqual([3418, 3419]);
    expect(enriched.find((item) => item.name === "Broom")?.publicBuildIds).toEqual([3419]);
  });

  it("extracts the BPB catalog and current patch from client chunks", () => {
    const key = "cb0f3e4a-56b8-449b-8441-88aab8d1127b";
    const source = Buffer.from(
      JSON.stringify([[70, 2.5, 1, [2, 4], "Throw once.", ["Nature"], 0, "Stone", "Common", [[1]], 0, "Ranged Weapon"]]),
    );
    const encoded = Buffer.alloc(source.length);

    for (let index = 0; index < source.length; index += 1) {
      encoded[index] = source[index] ^ key.charCodeAt(index % key.length);
    }

    const db = encoded.toString("base64");
    const catalog = extractBpbCatalogFromClientChunks([
      `65345:(F,V,B)=>{B.d(V,{DB:()=>R});let R="${db}"}`,
      `54338:(e,t,r)=>{"use strict";let i=[{version:"1.1.1",date:"2026-04-03T08:01:07.000Z",type:"regular"}]}`,
    ]);

    expect(catalog.patchVersion).toBe("1.1.1");
    expect(catalog.items[0]).toMatchObject({
      gid: 0,
      name: "Stone",
      rarity: "Common",
      src: "/i/Stone.webp",
      type: "Ranged Weapon",
    });
  });

  it("extracts absolute script URLs for BPB catalog provenance", () => {
    const html = [
      `<script src="/_next/static/chunks/catalog.js"></script>`,
      `<script src="https://bpb-builds.vercel.app/_next/static/chunks/catalog.js"></script>`,
      `<script src="/_next/static/chunks/app/items/page.js"></script>`,
      `<script src="/stats/script.js"></script>`,
      `<script src="https://example.com/_next/static/chunks/foreign.js"></script>`,
    ].join("");

    expect(extractScriptUrlsFromHtml(html, "https://bpb-builds.vercel.app/items")).toEqual([
      "https://bpb-builds.vercel.app/_next/static/chunks/catalog.js",
      "https://bpb-builds.vercel.app/_next/static/chunks/app/items/page.js",
    ]);
  });

  it("rejects catalogs that cannot provide BPB gids", () => {
    expect(() => extractBpbCatalogFromClientChunks(["console.log('no catalog here')"])).toThrow(
      "Could not find BPB item catalog",
    );
  });
});
