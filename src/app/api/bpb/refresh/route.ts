import { NextResponse } from "next/server";
import {
  attachBuildReferencesToItems,
  extractBpbCatalogFromClientChunks,
  extractItemIndexFromItemsHtml,
  extractScriptUrlsFromHtml,
  normalizeBuildsPage,
} from "@/lib/bpb/importer";
import { fetchTextWithTimeout } from "@/lib/bpb/fetch";
import { DEFAULT_BPB_CACHE_PATH, writeBpbCache } from "@/lib/bpb/store";

const ITEMS_URL = "https://bpb-builds.vercel.app/items";
const BUILDS_URL = "https://bpb-builds.vercel.app/api/builds";
const BUILD_PAGE_LIMIT = 100;

async function fetchJson(url: string): Promise<unknown> {
  const text = await fetchTextWithTimeout(url);

  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    throw new Error(`Invalid JSON from ${url}`, { cause: error });
  }
}

async function fetchCatalog(itemsHtml: string) {
  const sourceUrls = extractScriptUrlsFromHtml(itemsHtml, ITEMS_URL);
  const chunks = await Promise.all(sourceUrls.map((url) => fetchTextWithTimeout(url)));

  return {
    catalog: extractBpbCatalogFromClientChunks(chunks),
    sourceUrls,
  };
}

async function fetchAllBuilds() {
  const pageUrls = [`${BUILDS_URL}?limit=${BUILD_PAGE_LIMIT}&offset=0`];
  const firstPage = normalizeBuildsPage(await fetchJson(pageUrls[0]));
  const offsets: number[] = [];

  for (let offset = firstPage.offset + firstPage.limit; offset < firstPage.total; offset += firstPage.limit) {
    offsets.push(offset);
  }

  const remainingPageUrls = offsets.map((offset) => `${BUILDS_URL}?limit=${BUILD_PAGE_LIMIT}&offset=${offset}`);
  const remainingPages = await Promise.all(
    remainingPageUrls.map(async (url) => normalizeBuildsPage(await fetchJson(url))),
  );
  const buildsById = new Map(
    [firstPage, ...remainingPages].flatMap((page) => page.builds).map((build) => [build.id, build]),
  );

  return {
    builds: Array.from(buildsById.values()),
    pageUrls: [...pageUrls, ...remainingPageUrls],
  };
}

export async function POST() {
  try {
    const itemsHtml = await fetchTextWithTimeout(ITEMS_URL);
    const [catalogResult, buildResult] = await Promise.all([fetchCatalog(itemsHtml), fetchAllBuilds()]);
    const items = attachBuildReferencesToItems(
      extractItemIndexFromItemsHtml(itemsHtml, catalogResult.catalog.items),
      buildResult.builds,
    );

    await writeBpbCache(DEFAULT_BPB_CACHE_PATH, {
      fetchedAt: new Date().toISOString(),
      patchVersion: catalogResult.catalog.patchVersion,
      patchDate: catalogResult.catalog.patchDate,
      sourceUrls: [ITEMS_URL, ...catalogResult.sourceUrls, ...buildResult.pageUrls],
      items,
      builds: buildResult.builds,
    });

    return NextResponse.json({ items: items.length, builds: buildResult.builds.length });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to refresh BPB data" }, { status: 502 });
  }
}
