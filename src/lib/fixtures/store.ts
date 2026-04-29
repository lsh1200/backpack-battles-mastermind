import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { AnalysisResultSchema } from "@/lib/core/schemas";
import type { AnalysisResult } from "@/lib/core/types";

const FIXTURE_DIR = "data/fixtures";

export async function saveAnalysisFixture(result: AnalysisResult): Promise<string> {
  await mkdir(FIXTURE_DIR, { recursive: true });
  const id = new Date().toISOString().replace(/[:.]/g, "-");
  const path = join(FIXTURE_DIR, `${id}.json`);
  await writeFile(path, `${JSON.stringify(AnalysisResultSchema.parse(result), null, 2)}\n`, "utf8");
  return path;
}

export async function listAnalysisFixtures(): Promise<AnalysisResult[]> {
  try {
    const files = (await readdir(FIXTURE_DIR)).filter((file) => file.endsWith(".json")).sort().reverse();
    const recent = files.slice(0, 20);
    return Promise.all(
      recent.map(async (file) => AnalysisResultSchema.parse(JSON.parse(await readFile(join(FIXTURE_DIR, file), "utf8")))),
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}
