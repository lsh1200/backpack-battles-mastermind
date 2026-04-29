import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { normalizeItemName } from "./importer";
import { BpbCacheSchema, type BpbCache, type BpbItem } from "./schemas";

export const DEFAULT_BPB_CACHE_PATH = "data/bpb/cache.json";

export async function readBpbCache(path = DEFAULT_BPB_CACHE_PATH): Promise<BpbCache | null> {
  try {
    const text = await readFile(path, "utf8");
    try {
      return BpbCacheSchema.parse(JSON.parse(text));
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`Invalid BPB cache JSON at ${path}`, { cause: error });
      }

      throw error;
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

export async function writeBpbCache(path: string, cache: BpbCache): Promise<void> {
  const parsed = BpbCacheSchema.parse(cache);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
}

export function findBpbItemByName(cache: BpbCache, name: string): BpbItem | null {
  const normalized = normalizeItemName(name);
  return cache.items.find((item) => item.aliases.includes(normalized)) ?? null;
}
