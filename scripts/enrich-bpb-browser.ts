import { spawn } from "node:child_process";
import { join } from "node:path";
import { chromium } from "playwright";
import { enrichItemFromModalText, mergeEnrichedItem } from "../src/lib/bpb/detail-enricher";
import { DEFAULT_BPB_CACHE_PATH, readBpbCache, writeBpbCache } from "../src/lib/bpb/store";
import type { BpbItem } from "../src/lib/bpb/schemas";

const ITEMS_URL = "https://bpb-builds.vercel.app/items";

function isMissingBrowserExecutable(error: unknown): boolean {
  return error instanceof Error && error.message.includes("Executable doesn't exist");
}

async function installChromiumBrowser(): Promise<void> {
  const playwrightCli = join(process.cwd(), "node_modules", "playwright", "cli.js");

  await new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, [playwrightCli, "install", "chromium"], { stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`Playwright Chromium install failed with exit code ${code ?? "unknown"}`));
    });
  });
}

async function launchChromiumBrowser() {
  try {
    return await chromium.launch({ headless: true });
  } catch (error) {
    if (!isMissingBrowserExecutable(error)) {
      throw error;
    }

    console.warn("Playwright Chromium browser is missing. Installing it now...");
    await installChromiumBrowser();
    return chromium.launch({ headless: true });
  }
}

async function main() {
  if (process.env.BPB_BROWSER_ENRICH !== "1") {
    throw new Error("Set BPB_BROWSER_ENRICH=1 to run browser-based BPB detail enrichment");
  }

  const cache = await readBpbCache(DEFAULT_BPB_CACHE_PATH);
  if (!cache) {
    throw new Error("Run npm run refresh:bpb before enrichment");
  }

  const browser = await launchChromiumBrowser();
  let detailedCount = 0;

  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
    await page.goto(ITEMS_URL, { waitUntil: "networkidle" });

    const enrichedItems: BpbItem[] = [...cache.items];
    for (const item of cache.items) {
      try {
        await page.getByAltText(item.name).first().click({ timeout: 5_000 });
        const modal = page.locator(".ant-modal").first();
        await modal.waitFor({ state: "visible", timeout: 5_000 });

        const modalText = await modal.innerText();
        const merged = mergeEnrichedItem(item, enrichItemFromModalText(modalText));
        if (merged !== item) {
          detailedCount += 1;
        }
        const index = enrichedItems.findIndex((candidate) => candidate.id === item.id);
        if (index >= 0) {
          enrichedItems[index] = merged;
        }

        await page.keyboard.press("Escape");
        await modal.waitFor({ state: "hidden", timeout: 5_000 }).catch(() => undefined);
      } catch (error) {
        console.warn(`Skipped BPB item detail enrichment for ${item.name}:`, error);
      }
    }

    await writeBpbCache(DEFAULT_BPB_CACHE_PATH, {
      ...cache,
      fetchedAt: new Date().toISOString(),
      sourceUrls: Array.from(new Set([...cache.sourceUrls, ITEMS_URL])),
      items: enrichedItems,
    });
  } finally {
    await browser.close();
  }

  console.log(`Enriched ${detailedCount} BPB item records`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
