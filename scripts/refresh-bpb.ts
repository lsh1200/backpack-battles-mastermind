import {
  attachBuildReferencesToItems,
  extractBpbCatalogFromClientChunks,
  extractItemIndexFromItemsHtml,
  extractScriptUrlsFromHtml,
  normalizeBuildsPage,
} from "../src/lib/bpb/importer";
import { fetchTextWithTimeout } from "../src/lib/bpb/fetch";
import { DEFAULT_BPB_CACHE_PATH, writeBpbCache } from "../src/lib/bpb/store";

const ITEMS_URL = "https://bpb-builds.vercel.app/items";
const BUILDS_URL = "https://bpb-builds.vercel.app/api/builds";
const BUILD_PAGE_LIMIT = 100;

async function fetchText(url: string): Promise<string> {
  return fetchTextWithTimeout(url);
}

async function fetchJson(url: string): Promise<unknown> {
  const text = await fetchText(url);

  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    throw new Error(`Invalid JSON from ${url}`, { cause: error });
  }
}

async function fetchBpbCatalog(itemsHtml: string) {
  const sourceUrls = extractScriptUrlsFromHtml(itemsHtml, ITEMS_URL);
  const chunks = await Promise.all(sourceUrls.map(fetchText));

  return {
    catalog: extractBpbCatalogFromClientChunks(chunks),
    sourceUrls,
  };
}

async function fetchAllBuilds() {
  const pageUrls = [`${BUILDS_URL}?limit=${BUILD_PAGE_LIMIT}&offset=0`];
  const firstPage = normalizeBuildsPage(await fetchJson(pageUrls[0]));
  const offsets = [];

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

async function main() {
  const itemsHtml = await fetchText(ITEMS_URL);
  const [catalogResult, buildResult] = await Promise.all([fetchBpbCatalog(itemsHtml), fetchAllBuilds()]);
  const catalog = catalogResult.catalog;
  const builds = buildResult.builds;
  const items = attachBuildReferencesToItems(extractItemIndexFromItemsHtml(itemsHtml, catalog.items), builds);

  if (items.length < 400) {
    throw new Error(`BPB item extraction returned ${items.length} items; expected at least 400`);
  }
  if (items.some((item) => item.gid === undefined || item.id !== item.gid)) {
    throw new Error("BPB item extraction did not preserve BPB gids");
  }
  if (!catalog.patchVersion) {
    throw new Error("BPB catalog extraction did not detect a patch version");
  }

  await writeBpbCache(DEFAULT_BPB_CACHE_PATH, {
    fetchedAt: new Date().toISOString(),
    patchVersion: catalog.patchVersion,
    patchDate: catalog.patchDate,
    sourceUrls: [ITEMS_URL, ...catalogResult.sourceUrls, ...buildResult.pageUrls],
    items,
    builds,
  });

  console.log(`Wrote ${items.length} BPB items and ${builds.length} builds to ${DEFAULT_BPB_CACHE_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
