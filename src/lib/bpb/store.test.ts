import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { BpbCache } from "./schemas";
import { findBpbItemByName, readBpbCache, writeBpbCache } from "./store";

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "bpb-cache-"));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe("BPB store", () => {
  const cache: BpbCache = {
    fetchedAt: "2026-04-27T00:00:00.000Z",
    patchVersion: "1.1.1",
    patchDate: "2026-04-03T08:01:07.000Z",
    sourceUrls: ["https://bpb-builds.vercel.app/items"],
    items: [
      {
        id: 98,
        name: "Hero Sword",
        aliases: ["hero sword", "herosword"],
        imageUrl: "https://awerc.github.io/bpb-cdn/i/HeroSword.webp",
        grounded: true,
        tags: [],
      },
    ],
    builds: [],
  };

  it("writes and reads a validated cache", async () => {
    const path = join(tempDir, "bpb-cache.json");
    await writeBpbCache(path, cache);

    const raw = await readFile(path, "utf8");
    expect(JSON.parse(raw).items[0].name).toBe("Hero Sword");

    const read = await readBpbCache(path);
    if (!read) {
      throw new Error("Expected BPB cache to be readable after writing it");
    }

    expect(read.items).toHaveLength(1);
  });

  it("reports invalid cache JSON with the cache path", async () => {
    const path = join(tempDir, "broken-cache.json");
    await writeFile(path, "{broken", "utf8");

    await expect(readBpbCache(path)).rejects.toThrow(`Invalid BPB cache JSON at ${path}`);
  });

  it("finds items by canonical name and compact alias", () => {
    expect(findBpbItemByName(cache, "Hero Sword")?.id).toBe(98);
    expect(findBpbItemByName(cache, "herosword")?.id).toBe(98);
    expect(findBpbItemByName(cache, "Unknown Blade")).toBeNull();
  });
});
