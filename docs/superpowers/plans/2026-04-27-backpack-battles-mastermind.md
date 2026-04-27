# Backpack Battles Mastermind Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a phone-friendly PWA that accepts a Backpack Battles Android screenshot, grounds item/build knowledge in a local BPB cache, asks targeted correction questions when recognition is uncertain, and returns a useful next-move recommendation.

**Architecture:** Create a Next.js App Router application with server-side API routes for image analysis, fixture storage, BPB data refresh, and OpenAI vision calls. Keep the system modular: BPB data import/store, core schemas, strategy rules, pixel validation, correction loop, vision extraction, and UI are separate units with tests around the pure logic.

**Tech Stack:** Next.js App Router, TypeScript, React, Zod, Vitest, Cheerio, Sharp, OpenAI JavaScript SDK, Playwright, local JSON fixtures/cache.

---

## Scope Check

The approved spec has several subsystems. This plan builds the first working vertical slice in one project:

- local BPB item/build grounding;
- beginner strategy recommendation rules;
- screenshot upload and preview;
- pixel validation;
- LLM vision extraction through a server API route;
- targeted correction loop;
- local fixture persistence;
- phone-first PWA UI.

Automatic Android screen capture, native Android packaging, full combat simulation, and full item-object recognition without confirmation are excluded from this implementation plan.

## File Structure

Create and maintain these files:

- `package.json`: scripts and dependencies.
- `.gitignore`: local build, dependency, secret, and fixture exclusions.
- `tsconfig.json`: TypeScript configuration.
- `next.config.ts`: Next.js configuration.
- `eslint.config.mjs`: ESLint configuration.
- `vitest.config.ts`: Vitest configuration.
- `postcss.config.mjs`: Tailwind/PostCSS configuration created with the app.
- `src/app/layout.tsx`: root layout and metadata.
- `src/app/page.tsx`: main PWA coaching screen.
- `src/app/globals.css`: compact phone-first styling.
- `src/app/api/analyze/route.ts`: screenshot-to-recommendation pipeline endpoint.
- `src/app/api/bpb/refresh/route.ts`: explicit BPB cache refresh endpoint.
- `src/app/api/fixtures/route.ts`: recent fixture list endpoint.
- `src/components/ScreenshotIntake.tsx`: image upload and preview.
- `src/components/AnalysisStatePanel.tsx`: extracted state and validation display.
- `src/components/CorrectionPanel.tsx`: targeted correction questions.
- `src/components/RecommendationPanel.tsx`: coaching output.
- `src/components/HistoryPanel.tsx`: recent analyzed fixtures.
- `src/lib/core/schemas.ts`: Zod schemas for all shared data.
- `src/lib/core/types.ts`: inferred TypeScript types from schemas.
- `src/lib/bpb/schemas.ts`: BPB-specific schemas.
- `src/lib/bpb/importer.ts`: BPB HTML/API extraction and normalization.
- `src/lib/bpb/detail-enricher.ts`: parses item tooltip/modal text and enriches cache records.
- `src/lib/bpb/store.ts`: local BPB cache read/write and lookup.
- `src/lib/strategy/guide-notes.ts`: curated beginner knowledge extracted from the transcript.
- `src/lib/strategy/recommend.ts`: candidate action ranking and recommendation logic.
- `src/lib/vision/openai.ts`: OpenAI Responses vision call and JSON parsing.
- `src/lib/vision/pixel-validator.ts`: deterministic image checks.
- `src/lib/vision/correction.ts`: uncertainty-to-question logic and correction application.
- `src/lib/analysis/analyze.ts`: orchestrates BPB lookup, vision, validation, correction, and recommendation.
- `src/lib/fixtures/store.ts`: local filesystem fixture persistence.
- `scripts/refresh-bpb.ts`: command-line BPB refresh.
- `scripts/enrich-bpb-browser.ts`: explicit browser-based BPB item detail enrichment.
- `tests/fixtures/bpb/items-page.sample.html`: small saved BPB item HTML fixture.
- `tests/fixtures/bpb/builds.sample.json`: small saved BPB builds JSON fixture.
- `tests/fixtures/images/synthetic-shop.png`: generated during tests.
- `src/**/*.test.ts`: unit tests beside the logic they cover.

## Task 1: Scaffold App, Tooling, And Empty Home

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `tsconfig.json`
- Create: `next.config.ts`
- Create: `eslint.config.mjs`
- Create: `vitest.config.ts`
- Create: `postcss.config.mjs`
- Create: `src/app/layout.tsx`
- Create: `src/app/page.tsx`
- Create: `src/app/globals.css`

- [ ] **Step 1: Create package and config files**

Create `package.json`:

```json
{
  "name": "backpack-battles-mastermind",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "test": "vitest run",
    "test:watch": "vitest",
    "refresh:bpb": "tsx scripts/refresh-bpb.ts"
  },
  "dependencies": {
    "cheerio": "^1.1.2",
    "next": "^16.0.0",
    "openai": "^6.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "sharp": "^0.34.0",
    "zod": "^4.0.0"
  },
  "devDependencies": {
    "@eslint/eslintrc": "^3.3.0",
    "@playwright/test": "^1.56.0",
    "@testing-library/react": "^16.0.0",
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^5.0.0",
    "eslint": "^9.0.0",
    "eslint-config-next": "^16.0.0",
    "jsdom": "^27.0.0",
    "tsx": "^4.20.0",
    "typescript": "^5.9.0",
    "vitest": "^4.0.0"
  }
}
```

Create `.gitignore`:

```gitignore
.next/
node_modules/
.env.local
```

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "es2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

Create `next.config.ts`:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
};

export default nextConfig;
```

Create `eslint.config.mjs`:

```js
import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const compat = new FlatCompat({ baseDirectory: __dirname });

export default [...compat.extends("next/core-web-vitals", "next/typescript")];
```

Create `vitest.config.ts`:

```ts
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    globals: true,
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
```

Create `postcss.config.mjs`:

```js
export default {
  plugins: {},
};
```

- [ ] **Step 2: Create the empty app shell**

Create `src/app/layout.tsx`:

```tsx
import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Backpack Battles Mastermind",
  description: "Screenshot-based Backpack Battles coaching assistant.",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1f2a24",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

Create `src/app/page.tsx`:

```tsx
export default function HomePage() {
  return (
    <main className="app-shell">
      <section className="hero-panel">
        <p className="eyebrow">Backpack Battles Mastermind</p>
        <h1>Upload a round screenshot.</h1>
        <p className="lede">
          The app will read the board, check the image, ask for corrections when needed, and coach the next move.
        </p>
      </section>
    </main>
  );
}
```

Create `src/app/globals.css`:

```css
:root {
  color-scheme: dark;
  --bg: #121614;
  --panel: #202822;
  --panel-2: #2c352e;
  --text: #f2f0e6;
  --muted: #b8c3b4;
  --accent: #f0c35a;
  --danger: #ef767a;
  --line: rgba(255, 255, 255, 0.12);
}

* {
  box-sizing: border-box;
}

html,
body {
  min-height: 100%;
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font-family: Arial, Helvetica, sans-serif;
}

button,
input,
select,
textarea {
  font: inherit;
}

.app-shell {
  width: min(100%, 980px);
  min-height: 100vh;
  margin: 0 auto;
  padding: 16px;
}

.hero-panel {
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--panel);
  padding: 18px;
}

.eyebrow {
  margin: 0 0 8px;
  color: var(--accent);
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
}

h1 {
  margin: 0 0 10px;
  font-size: clamp(1.8rem, 7vw, 3rem);
  line-height: 1;
  letter-spacing: 0;
}

.lede {
  margin: 0;
  color: var(--muted);
  line-height: 1.45;
}
```

- [ ] **Step 3: Install dependencies**

Run:

```powershell
npm install
```

Expected: exits 0 and creates `package-lock.json`.

- [ ] **Step 4: Verify scaffold**

Run:

```powershell
npm run build
```

Expected: build completes with the home page.

- [ ] **Step 5: Commit**

```powershell
git add package.json package-lock.json .gitignore tsconfig.json next.config.ts eslint.config.mjs vitest.config.ts postcss.config.mjs src/app
git commit -m "feat: scaffold mastermind app"
```

## Task 2: Define Shared Schemas And Types

**Files:**
- Create: `src/lib/core/schemas.ts`
- Create: `src/lib/core/types.ts`
- Test: `src/lib/core/schemas.test.ts`

- [ ] **Step 1: Write schema tests**

Create `src/lib/core/schemas.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { AnalysisResultSchema, GameStateSchema, RecommendationSchema } from "./schemas";

describe("core schemas", () => {
  it("accepts a minimal corrected game state", () => {
    const state = GameStateSchema.parse({
      round: 4,
      gold: 8,
      lives: 4,
      wins: 2,
      className: "Ranger",
      bagChoice: "Ranger Bag",
      skills: [],
      subclass: null,
      shopItems: [{ name: "Broom", slot: "shop-1", sale: false }],
      backpackItems: [{ name: "Hero Sword", location: "bag", x: 1, y: 2 }],
      storageItems: [],
      userGoal: "learn",
      uncertainFields: [],
    });

    expect(state.className).toBe("Ranger");
    expect(state.shopItems[0].name).toBe("Broom");
  });

  it("rejects recommendations without a best action", () => {
    expect(() => RecommendationSchema.parse({ reason: "missing action" })).toThrow();
  });

  it("accepts the full analysis result shape", () => {
    const result = AnalysisResultSchema.parse({
      gameState: {
        round: 2,
        gold: 5,
        lives: 5,
        wins: 1,
        className: "Unknown",
        bagChoice: null,
        skills: [],
        subclass: null,
        shopItems: [],
        backpackItems: [],
        storageItems: [],
        userGoal: "learn",
        uncertainFields: ["className"],
      },
      validation: {
        image: { width: 2400, height: 1080, orientation: "landscape" },
        regions: [],
        warnings: ["class not visible"],
        requiresConfirmation: ["className"],
      },
      correctionQuestions: [
        {
          field: "className",
          question: "Which class are you playing?",
          options: ["Ranger", "Reaper", "Berserker", "Pyromancer"],
        },
      ],
      recommendation: null,
    });

    expect(result.correctionQuestions).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
npm run test -- src/lib/core/schemas.test.ts
```

Expected: FAIL because `./schemas` does not exist.

- [ ] **Step 3: Implement schemas**

Create `src/lib/core/schemas.ts`:

```ts
import { z } from "zod";

export const UserGoalSchema = z.enum(["learn", "climb", "force-plan", "experiment"]);

export const ShopItemSchema = z.object({
  name: z.string().min(1),
  slot: z.string().min(1),
  sale: z.boolean().default(false),
  price: z.number().int().nonnegative().optional(),
  groundedBpbId: z.number().int().nonnegative().optional(),
});

export const BackpackItemSchema = z.object({
  name: z.string().min(1),
  location: z.enum(["bag", "storage", "shop", "unknown"]),
  x: z.number().int().nonnegative().optional(),
  y: z.number().int().nonnegative().optional(),
  groundedBpbId: z.number().int().nonnegative().optional(),
});

export const GameStateSchema = z.object({
  round: z.number().int().min(1).max(18).nullable(),
  gold: z.number().int().nonnegative().nullable(),
  lives: z.number().int().min(0).max(5).nullable(),
  wins: z.number().int().min(0).max(18).nullable(),
  className: z.string().min(1),
  bagChoice: z.string().nullable(),
  skills: z.array(z.string()),
  subclass: z.string().nullable(),
  shopItems: z.array(ShopItemSchema),
  backpackItems: z.array(BackpackItemSchema),
  storageItems: z.array(BackpackItemSchema),
  battleLogSummary: z.string().optional(),
  userGoal: UserGoalSchema.default("learn"),
  uncertainFields: z.array(z.string()),
});

export const ValidationRegionSchema = z.object({
  name: z.string(),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  occupiedRatio: z.number().min(0).max(1).optional(),
});

export const ValidationReportSchema = z.object({
  image: z.object({
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    orientation: z.enum(["landscape", "portrait", "square"]),
  }),
  regions: z.array(ValidationRegionSchema),
  warnings: z.array(z.string()),
  requiresConfirmation: z.array(z.string()),
});

export const CorrectionQuestionSchema = z.object({
  field: z.string().min(1),
  question: z.string().min(1),
  options: z.array(z.string()).min(1),
});

export const CandidateActionSchema = z.object({
  type: z.enum(["buy", "sell", "roll", "lock", "reposition", "combine", "pick-skill", "pick-subclass", "start-battle"]),
  target: z.string(),
  value: z.number(),
  risks: z.array(z.string()),
  assumptions: z.array(z.string()),
  teachingReason: z.string(),
});

export const RecommendationSchema = z.object({
  bestAction: CandidateActionSchema,
  shortReason: z.string().min(1),
  rejectedAlternatives: z.array(CandidateActionSchema),
  planSupported: z.string().min(1),
  nextTargets: z.array(z.string()),
  assumptionsMade: z.array(z.string()),
  correctionPromptsUsed: z.array(z.string()),
});

export const AnalysisResultSchema = z.object({
  gameState: GameStateSchema,
  validation: ValidationReportSchema,
  correctionQuestions: z.array(CorrectionQuestionSchema),
  recommendation: RecommendationSchema.nullable(),
});
```

Create `src/lib/core/types.ts`:

```ts
import type { z } from "zod";
import type {
  AnalysisResultSchema,
  BackpackItemSchema,
  CandidateActionSchema,
  CorrectionQuestionSchema,
  GameStateSchema,
  RecommendationSchema,
  ShopItemSchema,
  ValidationReportSchema,
} from "./schemas";

export type AnalysisResult = z.infer<typeof AnalysisResultSchema>;
export type BackpackItem = z.infer<typeof BackpackItemSchema>;
export type CandidateAction = z.infer<typeof CandidateActionSchema>;
export type CorrectionQuestion = z.infer<typeof CorrectionQuestionSchema>;
export type GameState = z.infer<typeof GameStateSchema>;
export type Recommendation = z.infer<typeof RecommendationSchema>;
export type ShopItem = z.infer<typeof ShopItemSchema>;
export type ValidationReport = z.infer<typeof ValidationReportSchema>;
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```powershell
npm run test -- src/lib/core/schemas.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/lib/core
git commit -m "feat: add core analysis schemas"
```

## Task 3: Build BPB Importer And Local Store

**Files:**
- Create: `src/lib/bpb/schemas.ts`
- Create: `src/lib/bpb/importer.ts`
- Create: `src/lib/bpb/store.ts`
- Create: `scripts/refresh-bpb.ts`
- Create: `tests/fixtures/bpb/items-page.sample.html`
- Create: `tests/fixtures/bpb/builds.sample.json`
- Test: `src/lib/bpb/importer.test.ts`
- Test: `src/lib/bpb/store.test.ts`

- [ ] **Step 1: Write BPB importer fixtures**

Create `tests/fixtures/bpb/items-page.sample.html`:

```html
<!doctype html>
<html>
  <body>
    <a href="https://awerc.github.io/bpb-cdn/i/WoodenSword.webp"><img alt="Wooden Sword" src="https://awerc.github.io/bpb-cdn/i/WoodenSword.webp" /></a>
    <a href="https://awerc.github.io/bpb-cdn/i/Broom.webp"><img alt="Broom" src="https://awerc.github.io/bpb-cdn/i/Broom.webp" /></a>
    <a href="https://awerc.github.io/bpb-cdn/i/HeroSword.webp"><img alt="Hero Sword" src="https://awerc.github.io/bpb-cdn/i/HeroSword.webp" /></a>
  </body>
</html>
```

Create `tests/fixtures/bpb/builds.sample.json`:

```json
{
  "data": [
    {
      "id": 3418,
      "title": "empower spike berserker",
      "class": "Berserker",
      "subclass": "Wolf Emblem",
      "bag": "Duffle Bag",
      "difficulty": "Easy",
      "updatedAt": "2026-04-26T06:41:08.472+00:00",
      "tiers": [
        { "color": "#FF7F7F", "items": [42, 44, 98], "title": "S" }
      ],
      "snapshots": [
        { "order": 0, "buildId": 3418, "name": null, "items": [] }
      ]
    }
  ],
  "pagination": { "limit": 20, "offset": 0, "total": 1 }
}
```

- [ ] **Step 2: Write failing importer tests**

Create `src/lib/bpb/importer.test.ts`:

```ts
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { extractItemIndexFromItemsHtml, normalizeBuildsPayload, normalizeItemName } from "./importer";

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
        grounded: true,
        tags: [],
      },
      {
        id: 1,
        name: "Broom",
        aliases: ["broom"],
        imageUrl: "https://awerc.github.io/bpb-cdn/i/Broom.webp",
        grounded: true,
        tags: [],
      },
      {
        id: 2,
        name: "Hero Sword",
        aliases: ["hero sword", "herosword"],
        imageUrl: "https://awerc.github.io/bpb-cdn/i/HeroSword.webp",
        grounded: true,
        tags: [],
      },
    ]);
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
    });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run:

```powershell
npm run test -- src/lib/bpb/importer.test.ts
```

Expected: FAIL because `./importer` does not exist.

- [ ] **Step 4: Implement BPB schemas and importer**

Create `src/lib/bpb/schemas.ts`:

```ts
import { z } from "zod";

export const BpbItemSchema = z.object({
  id: z.number().int().nonnegative(),
  name: z.string().min(1),
  aliases: z.array(z.string()).min(1),
  imageUrl: z.string().url().optional(),
  className: z.string().optional(),
  rarity: z.string().optional(),
  type: z.string().optional(),
  tags: z.array(z.string()).default([]),
  effectText: z.string().optional(),
  recipe: z.array(z.string()).optional(),
  grounded: z.boolean(),
});

export const BpbBuildSchema = z.object({
  id: z.number().int().nonnegative(),
  title: z.string(),
  className: z.string().nullable(),
  subclass: z.string().nullable(),
  bag: z.string().nullable(),
  difficulty: z.string().nullable(),
  updatedAt: z.string().nullable(),
  itemIds: z.array(z.number().int().nonnegative()),
});

export const BpbCacheSchema = z.object({
  fetchedAt: z.string(),
  sourceUrls: z.array(z.string().url()),
  items: z.array(BpbItemSchema),
  builds: z.array(BpbBuildSchema),
});

export type BpbItem = z.infer<typeof BpbItemSchema>;
export type BpbBuild = z.infer<typeof BpbBuildSchema>;
export type BpbCache = z.infer<typeof BpbCacheSchema>;
```

Create `src/lib/bpb/importer.ts`:

```ts
import * as cheerio from "cheerio";
import type { BpbBuild, BpbItem } from "./schemas";

const BPB_CDN_PREFIX = "https://awerc.github.io/bpb-cdn/";

export function normalizeItemName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, " ")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function compactAliasFromImage(url: string): string | null {
  const match = url.match(/\/([^/]+)\.webp(?:$|\?)/i);
  return match ? match[1].toLowerCase() : null;
}

export function extractItemIndexFromItemsHtml(html: string): BpbItem[] {
  const $ = cheerio.load(html);
  const seen = new Map<string, BpbItem>();

  $("img").each((_, element) => {
    const alt = $(element).attr("alt")?.replace(/^Image:\s*/i, "").trim();
    const src = $(element).attr("src") || $(element).parent("a").attr("href");

    if (!alt || !src || !src.includes(BPB_CDN_PREFIX)) {
      return;
    }

    const imageUrl = src.startsWith("http") ? src : `${BPB_CDN_PREFIX}${src.replace(/^\/+/, "")}`;
    const normalized = normalizeItemName(alt);
    const compact = compactAliasFromImage(imageUrl);
    const aliases = Array.from(new Set([normalized, compact].filter(Boolean) as string[]));

    if (!seen.has(normalized)) {
      seen.set(normalized, {
        id: seen.size,
        name: alt,
        aliases,
        imageUrl,
        grounded: true,
        tags: [],
      });
    }
  });

  return Array.from(seen.values());
}

export function normalizeBuildsPayload(payload: unknown): BpbBuild[] {
  const data = Array.isArray((payload as { data?: unknown }).data)
    ? ((payload as { data: unknown[] }).data)
    : [];

  return data.map((build) => {
    const value = build as {
      id?: number;
      title?: string;
      class?: string | null;
      subclass?: string | null;
      bag?: string | null;
      difficulty?: string | null;
      updatedAt?: string | null;
      tiers?: Array<{ items?: number[] }>;
    };

    const itemIds = Array.from(
      new Set((value.tiers ?? []).flatMap((tier) => tier.items ?? [])),
    ).filter((itemId): itemId is number => Number.isInteger(itemId) && itemId >= 0);

    return {
      id: Number(value.id ?? 0),
      title: value.title ?? "Untitled build",
      className: value.class ?? null,
      subclass: value.subclass ?? null,
      bag: value.bag ?? null,
      difficulty: value.difficulty ?? null,
      updatedAt: value.updatedAt ?? null,
      itemIds,
    };
  });
}
```

- [ ] **Step 5: Run importer tests**

Run:

```powershell
npm run test -- src/lib/bpb/importer.test.ts
```

Expected: PASS.

- [ ] **Step 6: Write failing store tests**

Create `src/lib/bpb/store.test.ts`:

```ts
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { findBpbItemByName, readBpbCache, writeBpbCache } from "./store";
import type { BpbCache } from "./schemas";

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
    expect(read.items).toHaveLength(1);
  });

  it("finds items by canonical name and compact alias", () => {
    expect(findBpbItemByName(cache, "Hero Sword")?.id).toBe(98);
    expect(findBpbItemByName(cache, "herosword")?.id).toBe(98);
    expect(findBpbItemByName(cache, "Unknown Blade")).toBeNull();
  });
});
```

- [ ] **Step 7: Run store test to verify it fails**

Run:

```powershell
npm run test -- src/lib/bpb/store.test.ts
```

Expected: FAIL because `./store` does not exist.

- [ ] **Step 8: Implement BPB store**

Create `src/lib/bpb/store.ts`:

```ts
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { normalizeItemName } from "./importer";
import { BpbCacheSchema, type BpbCache, type BpbItem } from "./schemas";

export const DEFAULT_BPB_CACHE_PATH = "data/bpb/cache.json";

export async function readBpbCache(path = DEFAULT_BPB_CACHE_PATH): Promise<BpbCache | null> {
  try {
    const text = await readFile(path, "utf8");
    return BpbCacheSchema.parse(JSON.parse(text));
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
```

- [ ] **Step 9: Add refresh script**

Create `scripts/refresh-bpb.ts`:

```ts
import { extractItemIndexFromItemsHtml, normalizeBuildsPayload } from "../src/lib/bpb/importer";
import { DEFAULT_BPB_CACHE_PATH, writeBpbCache } from "../src/lib/bpb/store";

const ITEMS_URL = "https://bpb-builds.vercel.app/items";
const BUILDS_URL = "https://bpb-builds.vercel.app/api/builds";

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  return response.text();
}

async function main() {
  const [itemsHtml, buildsText] = await Promise.all([fetchText(ITEMS_URL), fetchText(BUILDS_URL)]);
  const items = extractItemIndexFromItemsHtml(itemsHtml);
  const builds = normalizeBuildsPayload(JSON.parse(buildsText));

  if (items.length < 400) {
    throw new Error(`BPB item extraction returned ${items.length} items; expected at least 400`);
  }

  await writeBpbCache(DEFAULT_BPB_CACHE_PATH, {
    fetchedAt: new Date().toISOString(),
    sourceUrls: [ITEMS_URL, BUILDS_URL],
    items,
    builds,
  });

  console.log(`Wrote ${items.length} BPB items and ${builds.length} builds to ${DEFAULT_BPB_CACHE_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
```

- [ ] **Step 10: Run BPB tests and refresh**

Run:

```powershell
npm run test -- src/lib/bpb/importer.test.ts src/lib/bpb/store.test.ts
npm run refresh:bpb
```

Expected: tests PASS, and refresh writes `data/bpb/cache.json` with at least 400 BPB items.

- [ ] **Step 11: Commit**

```powershell
git add src/lib/bpb scripts/refresh-bpb.ts tests/fixtures/bpb data/bpb/cache.json
git commit -m "feat: add BPB local data cache"
```

## Task 4: Add BPB Detail Enrichment Guard

**Files:**
- Create: `src/lib/bpb/detail-enricher.ts`
- Create: `scripts/enrich-bpb-browser.ts`
- Test: `src/lib/bpb/detail-enricher.test.ts`

- [ ] **Step 1: Write failing detail parser tests**

Create `src/lib/bpb/detail-enricher.test.ts`:

```ts
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

    expect(merged).toMatchObject({
      id: 98,
      name: "Hero Sword",
      rarity: "Rare",
      type: "Melee",
      effectText: "Every 1.8s: Deal 4-6 damage.",
      grounded: true,
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
npm run test -- src/lib/bpb/detail-enricher.test.ts
```

Expected: FAIL because `./detail-enricher` does not exist.

- [ ] **Step 3: Implement detail enrichment helpers**

Create `src/lib/bpb/detail-enricher.ts`:

```ts
import type { BpbItem } from "./schemas";

type EnrichedDetails = {
  name: string;
  rarity?: string;
  type?: string;
  effectText?: string;
};

const KNOWN_RARITIES = new Set(["Common", "Rare", "Epic", "Legendary", "Godly", "Unique"]);

export function enrichItemFromModalText(text: string): EnrichedDetails {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const [name, ...rest] = lines;
  const rarity = rest.find((line) => KNOWN_RARITIES.has(line));
  const rarityIndex = rarity ? rest.indexOf(rarity) : -1;
  const type = rarityIndex >= 0 ? rest[rarityIndex + 1] : undefined;
  const effectLines = rarityIndex >= 0 ? rest.slice(rarityIndex + 2) : rest.slice(1);

  return {
    name,
    rarity,
    type,
    effectText: effectLines.length ? effectLines.join("\n") : undefined,
  };
}

export function mergeEnrichedItem(item: BpbItem, details: EnrichedDetails): BpbItem {
  if (item.name !== details.name) {
    return item;
  }

  return {
    ...item,
    rarity: details.rarity ?? item.rarity,
    type: details.type ?? item.type,
    effectText: details.effectText ?? item.effectText,
  };
}
```

- [ ] **Step 4: Add explicit browser enrichment script**

Create `scripts/enrich-bpb-browser.ts`:

```ts
import { chromium } from "playwright";
import { enrichItemFromModalText, mergeEnrichedItem } from "../src/lib/bpb/detail-enricher";
import { DEFAULT_BPB_CACHE_PATH, readBpbCache, writeBpbCache } from "../src/lib/bpb/store";

const BPB_ITEMS_URL = "https://bpb-builds.vercel.app/items";

async function main() {
  if (process.env.BPB_BROWSER_ENRICH !== "1") {
    throw new Error("Set BPB_BROWSER_ENRICH=1 to run browser-based BPB detail enrichment");
  }

  const cache = await readBpbCache(DEFAULT_BPB_CACHE_PATH);
  if (!cache) {
    throw new Error("Run npm run refresh:bpb before enrichment");
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
  await page.goto(BPB_ITEMS_URL, { waitUntil: "networkidle" });

  const enrichedItems = [...cache.items];
  for (const item of cache.items) {
    const locator = page.getByAltText(item.name).first();
    if (!(await locator.count())) continue;

    await locator.click();
    const modal = page.locator(".ant-modal").first();
    await modal.waitFor({ state: "visible", timeout: 5000 });
    const text = await modal.innerText();
    const details = enrichItemFromModalText(text);
    const index = enrichedItems.findIndex((candidate) => candidate.id === item.id);
    if (index >= 0) enrichedItems[index] = mergeEnrichedItem(enrichedItems[index], details);
    await page.keyboard.press("Escape");
  }

  await browser.close();
  await writeBpbCache(DEFAULT_BPB_CACHE_PATH, {
    ...cache,
    fetchedAt: new Date().toISOString(),
    sourceUrls: Array.from(new Set([...cache.sourceUrls, BPB_ITEMS_URL])),
    items: enrichedItems,
  });

  const detailedCount = enrichedItems.filter((item) => item.effectText || item.rarity || item.type).length;
  console.log(`Enriched ${detailedCount} BPB item records`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
```

- [ ] **Step 5: Add package script**

In `package.json`, add this script beside `refresh:bpb`:

```json
"enrich:bpb": "tsx scripts/enrich-bpb-browser.ts"
```

- [ ] **Step 6: Run detail tests**

Run:

```powershell
npm run test -- src/lib/bpb/detail-enricher.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add src/lib/bpb/detail-enricher.ts src/lib/bpb/detail-enricher.test.ts scripts/enrich-bpb-browser.ts package.json package-lock.json
git commit -m "feat: add BPB detail enrichment guard"
```

## Task 5: Add Beginner Guide Knowledge And Recommendation Rules

**Files:**
- Create: `src/lib/strategy/guide-notes.ts`
- Create: `src/lib/strategy/recommend.ts`
- Test: `src/lib/strategy/recommend.test.ts`

- [ ] **Step 1: Write failing recommendation tests**

Create `src/lib/strategy/recommend.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { BpbCache } from "@/lib/bpb/schemas";
import type { GameState } from "@/lib/core/types";
import { recommendNextAction } from "./recommend";

const bpbCache: BpbCache = {
  fetchedAt: "2026-04-27T00:00:00.000Z",
  sourceUrls: ["https://bpb-builds.vercel.app/items"],
  items: [
    { id: 44, name: "Broom", aliases: ["broom"], imageUrl: "https://awerc.github.io/bpb-cdn/i/Broom.webp", grounded: true, tags: [] },
    { id: 51, name: "Whetstone", aliases: ["whetstone"], imageUrl: "https://awerc.github.io/bpb-cdn/i/Whetstone.webp", grounded: true, tags: [] },
    { id: 91, name: "Mana Orb", aliases: ["mana orb", "manaorb"], imageUrl: "https://awerc.github.io/bpb-cdn/i/ManaOrb.webp", grounded: true, tags: [] },
    { id: 98, name: "Hero Sword", aliases: ["hero sword", "herosword"], imageUrl: "https://awerc.github.io/bpb-cdn/i/HeroSword.webp", grounded: true, tags: [] }
  ],
  builds: [],
};

function baseState(overrides: Partial<GameState>): GameState {
  return {
    round: 3,
    gold: 6,
    lives: 5,
    wins: 1,
    className: "Ranger",
    bagChoice: "Ranger Bag",
    skills: [],
    subclass: null,
    shopItems: [],
    backpackItems: [{ name: "Hero Sword", location: "bag", groundedBpbId: 98 }],
    storageItems: [],
    userGoal: "learn",
    uncertainFields: [],
    ...overrides,
  };
}

describe("recommendNextAction", () => {
  it("prioritizes sale items because they are low-risk tempo", () => {
    const recommendation = recommendNextAction({
      gameState: baseState({
        shopItems: [{ name: "Broom", slot: "shop-1", sale: true, groundedBpbId: 44 }],
      }),
      bpbCache,
      correctionPromptsUsed: [],
    });

    expect(recommendation.bestAction.type).toBe("buy");
    expect(recommendation.bestAction.target).toContain("Broom");
    expect(recommendation.shortReason).toContain("sale");
  });

  it("flags ungrounded item-specific advice as an assumption", () => {
    const recommendation = recommendNextAction({
      gameState: baseState({
        shopItems: [{ name: "Mystery Blade", slot: "shop-2", sale: false }],
      }),
      bpbCache,
      correctionPromptsUsed: [],
    });

    expect(recommendation.assumptionsMade.some((text) => text.includes("Mystery Blade"))).toBe(true);
  });

  it("recommends rolling less when the round is too early for rare targets", () => {
    const recommendation = recommendNextAction({
      gameState: baseState({
        round: 2,
        gold: 2,
        shopItems: [],
      }),
      bpbCache,
      correctionPromptsUsed: [],
    });

    expect(recommendation.bestAction.type).toBe("start-battle");
    expect(recommendation.shortReason).toContain("tempo");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
npm run test -- src/lib/strategy/recommend.test.ts
```

Expected: FAIL because `./recommend` does not exist.

- [ ] **Step 3: Implement guide notes and recommendation logic**

Create `src/lib/strategy/guide-notes.ts`:

```ts
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
    "Beginner Ranger likes Hero Sword paths, Broom, Whetstone, luck, arrows, stones, and clean aggro tempo.",
    "Broom plus Mana Orb can point toward Magic Staff.",
    "Whetstone plus Ripsaw Blade can point toward Katana.",
  ],
  Reaper: [
    "Beginner Reaper plays more control-oriented and can use poison, staff, cauldron-style plans, and fatigue pivots.",
  ],
  Berserker: [
    "Beginner Berserker can follow a simple double-axe plan with gloves and dragon-scaled support items.",
  ],
  Pyromancer: [
    "Beginner Pyromancer can prioritize Burning Blade, heat items, dragons, and amulet-driven pivots.",
  ],
};
```

Create `src/lib/strategy/recommend.ts`:

```ts
import { findBpbItemByName } from "@/lib/bpb/store";
import type { BpbCache } from "@/lib/bpb/schemas";
import type { CandidateAction, GameState, Recommendation, ShopItem } from "@/lib/core/types";
import { classPlans } from "./guide-notes";

type RecommendInput = {
  gameState: GameState;
  bpbCache: BpbCache | null;
  correctionPromptsUsed: string[];
};

function isGrounded(cache: BpbCache | null, itemName: string): boolean {
  return cache ? findBpbItemByName(cache, itemName) !== null : false;
}

function buyAction(item: ShopItem, value: number, reason: string): CandidateAction {
  return {
    type: "buy",
    target: item.name,
    value,
    risks: item.sale ? [] : ["Spending gold reduces roll flexibility this round."],
    assumptions: [],
    teachingReason: reason,
  };
}

export function recommendNextAction(input: RecommendInput): Recommendation {
  const { gameState, bpbCache, correctionPromptsUsed } = input;
  const assumptionsMade: string[] = [];
  const rejectedAlternatives: CandidateAction[] = [];

  for (const item of [...gameState.shopItems, ...gameState.backpackItems]) {
    if (!isGrounded(bpbCache, item.name)) {
      assumptionsMade.push(`${item.name} is not grounded in the local BPB cache; avoid item-specific claims until confirmed.`);
    }
  }

  const sale = gameState.shopItems.find((item) => item.sale);
  if (sale) {
    return {
      bestAction: buyAction(sale, 90, `Buy ${sale.name}: it is on sale, so it is low-risk tempo and can usually be sold back later.`),
      shortReason: `Buy the sale ${sale.name} because sale items are low-risk tempo while you are still learning.`,
      rejectedAlternatives,
      planSupported: classPlans[gameState.className]?.[0] ?? "Keep the current plan stable while collecting grounded information.",
      nextTargets: ["Watch for core plan pieces next shop.", "Avoid rolling below useful gold unless you are chasing a known target."],
      assumptionsMade,
      correctionPromptsUsed,
    };
  }

  if ((gameState.round ?? 1) <= 3 && (gameState.gold ?? 0) <= 2) {
    return {
      bestAction: {
        type: "start-battle",
        target: "current board",
        value: 60,
        risks: ["You may miss a shop improvement, but low gold makes rolling weak."],
        assumptions: [],
        teachingReason: "Early rounds are tempo-sensitive. With little gold left, rolling is unlikely to find a specific plan piece.",
      },
      shortReason: "Preserve tempo and start the battle instead of spending your last gold on weak early rolls.",
      rejectedAlternatives,
      planSupported: classPlans[gameState.className]?.[0] ?? "Stay on the safest current plan.",
      nextTargets: ["Enter the next shop with a clear target.", "Prioritize commons and cheap plan pieces early."],
      assumptionsMade,
      correctionPromptsUsed,
    };
  }

  return {
    bestAction: {
      type: "start-battle",
      target: "current board",
      value: 50,
      risks: ["This is a safe default because no higher-value grounded action was found."],
      assumptions: assumptionsMade,
      teachingReason: "When no grounded shop action is clearly better, keep tempo and gather more information next round.",
    },
    shortReason: "No grounded buy or pivot is clearly better, so keep tempo and continue the current plan.",
    rejectedAlternatives,
    planSupported: classPlans[gameState.className]?.[0] ?? "Current board fundamentals.",
    nextTargets: ["Look for plan-defining signpost items.", "Confirm unknown items so advice can become more precise."],
    assumptionsMade,
    correctionPromptsUsed,
  };
}
```

- [ ] **Step 4: Run recommendation tests**

Run:

```powershell
npm run test -- src/lib/strategy/recommend.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/lib/strategy
git commit -m "feat: add grounded beginner recommendations"
```

## Task 6: Add Pixel Validator

**Files:**
- Create: `src/lib/vision/pixel-validator.ts`
- Test: `src/lib/vision/pixel-validator.test.ts`

- [ ] **Step 1: Write failing pixel validator tests**

Create `src/lib/vision/pixel-validator.test.ts`:

```ts
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { validateScreenshotPixels } from "./pixel-validator";

describe("validateScreenshotPixels", () => {
  it("identifies landscape screenshots and coarse regions", async () => {
    const image = await sharp({
      create: {
        width: 2400,
        height: 1080,
        channels: 3,
        background: "#202020",
      },
    })
      .png()
      .toBuffer();

    const report = await validateScreenshotPixels(image);

    expect(report.image.orientation).toBe("landscape");
    expect(report.regions.map((region) => region.name)).toEqual(["shop", "backpack", "status"]);
  });

  it("asks for a clearer screenshot when the image is too small", async () => {
    const image = await sharp({
      create: {
        width: 300,
        height: 200,
        channels: 3,
        background: "#202020",
      },
    })
      .png()
      .toBuffer();

    const report = await validateScreenshotPixels(image);

    expect(report.requiresConfirmation).toContain("screenshotQuality");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
npm run test -- src/lib/vision/pixel-validator.test.ts
```

Expected: FAIL because `./pixel-validator` does not exist.

- [ ] **Step 3: Implement pixel validator**

Create `src/lib/vision/pixel-validator.ts`:

```ts
import sharp from "sharp";
import type { ValidationReport } from "@/lib/core/types";

export async function validateScreenshotPixels(image: Buffer): Promise<ValidationReport> {
  const metadata = await sharp(image).metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  const orientation = width === height ? "square" : width > height ? "landscape" : "portrait";
  const warnings: string[] = [];
  const requiresConfirmation: string[] = [];

  if (width < 1000 || height < 600) {
    warnings.push("Screenshot is small; item text and icons may be hard to read.");
    requiresConfirmation.push("screenshotQuality");
  }

  if (orientation !== "landscape") {
    warnings.push("Expected a landscape Backpack Battles shop screenshot.");
    requiresConfirmation.push("orientation");
  }

  const regions = [
    { name: "shop", x: width * 0.02, y: height * 0.08, width: width * 0.34, height: height * 0.72 },
    { name: "backpack", x: width * 0.38, y: height * 0.08, width: width * 0.42, height: height * 0.82 },
    { name: "status", x: width * 0.80, y: height * 0.02, width: width * 0.18, height: height * 0.18 },
  ];

  return {
    image: { width, height, orientation },
    regions,
    warnings,
    requiresConfirmation,
  };
}
```

- [ ] **Step 4: Run pixel validator tests**

Run:

```powershell
npm run test -- src/lib/vision/pixel-validator.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/lib/vision/pixel-validator.ts src/lib/vision/pixel-validator.test.ts
git commit -m "feat: add screenshot pixel validation"
```

## Task 7: Add Correction Loop

**Files:**
- Create: `src/lib/vision/correction.ts`
- Test: `src/lib/vision/correction.test.ts`

- [ ] **Step 1: Write failing correction tests**

Create `src/lib/vision/correction.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { GameState, ValidationReport } from "@/lib/core/types";
import { applyCorrections, buildCorrectionQuestions } from "./correction";

const state: GameState = {
  round: null,
  gold: 7,
  lives: 5,
  wins: 1,
  className: "Unknown",
  bagChoice: null,
  skills: [],
  subclass: null,
  shopItems: [{ name: "Brom", slot: "shop-1", sale: false }],
  backpackItems: [],
  storageItems: [],
  userGoal: "learn",
  uncertainFields: ["className", "shopItems.0.name"],
};

const validation: ValidationReport = {
  image: { width: 2400, height: 1080, orientation: "landscape" },
  regions: [],
  warnings: [],
  requiresConfirmation: ["className"],
};

describe("correction loop", () => {
  it("builds targeted questions for uncertain fields", () => {
    const questions = buildCorrectionQuestions(state, validation, ["Broom", "Pan", "Hero Sword"]);

    expect(questions).toContainEqual({
      field: "className",
      question: "Which class are you playing?",
      options: ["Ranger", "Reaper", "Berserker", "Pyromancer", "Mage", "Adventurer", "Engineer"],
    });
    expect(questions.some((question) => question.field === "shopItems.0.name")).toBe(true);
  });

  it("applies class and shop item corrections", () => {
    const corrected = applyCorrections(state, {
      className: "Ranger",
      "shopItems.0.name": "Broom",
    });

    expect(corrected.className).toBe("Ranger");
    expect(corrected.shopItems[0].name).toBe("Broom");
    expect(corrected.uncertainFields).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
npm run test -- src/lib/vision/correction.test.ts
```

Expected: FAIL because `./correction` does not exist.

- [ ] **Step 3: Implement correction loop**

Create `src/lib/vision/correction.ts`:

```ts
import type { CorrectionQuestion, GameState, ValidationReport } from "@/lib/core/types";

const CLASS_OPTIONS = ["Ranger", "Reaper", "Berserker", "Pyromancer", "Mage", "Adventurer", "Engineer"];

export function buildCorrectionQuestions(
  gameState: GameState,
  validation: ValidationReport,
  knownItemNames: string[],
): CorrectionQuestion[] {
  const fields = Array.from(new Set([...gameState.uncertainFields, ...validation.requiresConfirmation]));

  return fields.map((field) => {
    if (field === "className") {
      return {
        field,
        question: "Which class are you playing?",
        options: CLASS_OPTIONS,
      };
    }

    if (field.startsWith("shopItems.") && field.endsWith(".name")) {
      return {
        field,
        question: "Which shop item is this?",
        options: knownItemNames.slice(0, 12),
      };
    }

    return {
      field,
      question: `Confirm ${field}`,
      options: ["Correct", "Needs manual edit"],
    };
  });
}

export function applyCorrections(gameState: GameState, corrections: Record<string, string>): GameState {
  const next: GameState = structuredClone(gameState);

  for (const [field, value] of Object.entries(corrections)) {
    if (field === "className") {
      next.className = value;
    }

    const shopItemMatch = field.match(/^shopItems\.(\d+)\.name$/);
    if (shopItemMatch) {
      const index = Number(shopItemMatch[1]);
      if (next.shopItems[index]) {
        next.shopItems[index].name = value;
      }
    }
  }

  next.uncertainFields = next.uncertainFields.filter((field) => !(field in corrections));
  return next;
}
```

- [ ] **Step 4: Run correction tests**

Run:

```powershell
npm run test -- src/lib/vision/correction.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/lib/vision/correction.ts src/lib/vision/correction.test.ts
git commit -m "feat: add targeted correction loop"
```

## Task 8: Add OpenAI Vision Extractor

**Files:**
- Create: `src/lib/vision/openai.ts`
- Test: `src/lib/vision/openai.test.ts`

- [ ] **Step 1: Write failing OpenAI extractor tests with a mocked client**

Create `src/lib/vision/openai.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseVisionJson, toDataUrl } from "./openai";

describe("OpenAI vision helpers", () => {
  it("converts images to data URLs", () => {
    const url = toDataUrl(Buffer.from("abc"), "image/png");
    expect(url).toBe("data:image/png;base64,YWJj");
  });

  it("parses fenced JSON returned by the model", () => {
    const parsed = parseVisionJson("```json\n{\"className\":\"Ranger\",\"shopItems\":[]}\n```");
    expect(parsed).toEqual({ className: "Ranger", shopItems: [] });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
npm run test -- src/lib/vision/openai.test.ts
```

Expected: FAIL because `./openai` does not exist.

- [ ] **Step 3: Implement OpenAI vision extractor**

Create `src/lib/vision/openai.ts`:

```ts
import OpenAI from "openai";
import { GameStateSchema } from "@/lib/core/schemas";
import type { GameState } from "@/lib/core/types";
import type { BpbItem } from "@/lib/bpb/schemas";

type ExtractInput = {
  image: Buffer;
  mimeType: string;
  relevantItems: BpbItem[];
};

export function toDataUrl(image: Buffer, mimeType: string): string {
  return `data:${mimeType};base64,${image.toString("base64")}`;
}

export function parseVisionJson(text: string): unknown {
  const trimmed = text.trim();
  const withoutFence = trimmed
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  return JSON.parse(withoutFence);
}

export async function extractGameStateWithVision(input: ExtractInput): Promise<GameState> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const itemNames = input.relevantItems.map((item) => item.name).join(", ");

  const response = await client.responses.create({
    model: process.env.OPENAI_VISION_MODEL ?? "gpt-4.1-mini",
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: [
              "Analyze this Backpack Battles shop screenshot.",
              "Return only JSON matching the GameState shape.",
              "Use these grounded BPB item names when possible:",
              itemNames || "No local items were provided.",
              "Use uncertainFields for any class, gold, round, item, or location you are not confident about.",
            ].join("\n"),
          },
          {
            type: "input_image",
            image_url: toDataUrl(input.image, input.mimeType),
          },
        ],
      },
    ],
  });

  return GameStateSchema.parse(parseVisionJson(response.output_text));
}
```

The OpenAI Responses API image input format comes from the official image/vision guide: https://platform.openai.com/docs/guides/images-vision

- [ ] **Step 4: Run OpenAI helper tests**

Run:

```powershell
npm run test -- src/lib/vision/openai.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/lib/vision/openai.ts src/lib/vision/openai.test.ts
git commit -m "feat: add vision extraction client"
```

## Task 9: Add Analysis Orchestrator, Fixture Store, And API Routes

**Files:**
- Create: `src/lib/fixtures/store.ts`
- Create: `src/lib/analysis/analyze.ts`
- Create: `src/app/api/analyze/route.ts`
- Create: `src/app/api/bpb/refresh/route.ts`
- Create: `src/app/api/fixtures/route.ts`
- Test: `src/lib/analysis/analyze.test.ts`

- [ ] **Step 1: Write failing analysis test**

Create `src/lib/analysis/analyze.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { BpbCache } from "@/lib/bpb/schemas";
import { analyzeCorrectedState } from "./analyze";

const cache: BpbCache = {
  fetchedAt: "2026-04-27T00:00:00.000Z",
  sourceUrls: ["https://bpb-builds.vercel.app/items"],
  items: [{ id: 44, name: "Broom", aliases: ["broom"], imageUrl: "https://awerc.github.io/bpb-cdn/i/Broom.webp", grounded: true, tags: [] }],
  builds: [],
};

describe("analysis orchestrator", () => {
  it("returns correction questions before recommendation when fields are uncertain", async () => {
    const result = await analyzeCorrectedState({
      gameState: {
        round: 3,
        gold: 6,
        lives: 5,
        wins: 1,
        className: "Unknown",
        bagChoice: null,
        skills: [],
        subclass: null,
        shopItems: [{ name: "Brom", slot: "shop-1", sale: false }],
        backpackItems: [],
        storageItems: [],
        userGoal: "learn",
        uncertainFields: ["className", "shopItems.0.name"],
      },
      validation: {
        image: { width: 2400, height: 1080, orientation: "landscape" },
        regions: [],
        warnings: [],
        requiresConfirmation: [],
      },
      bpbCache: cache,
      correctionPromptsUsed: [],
    });

    expect(result.recommendation).toBeNull();
    expect(result.correctionQuestions.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
npm run test -- src/lib/analysis/analyze.test.ts
```

Expected: FAIL because `./analyze` does not exist.

- [ ] **Step 3: Implement fixture store**

Create `src/lib/fixtures/store.ts`:

```ts
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
```

- [ ] **Step 4: Implement analysis orchestrator**

Create `src/lib/analysis/analyze.ts`:

```ts
import type { BpbCache } from "@/lib/bpb/schemas";
import { findBpbItemByName } from "@/lib/bpb/store";
import type { AnalysisResult, GameState, ValidationReport } from "@/lib/core/types";
import { recommendNextAction } from "@/lib/strategy/recommend";
import { buildCorrectionQuestions } from "@/lib/vision/correction";

type AnalyzeCorrectedStateInput = {
  gameState: GameState;
  validation: ValidationReport;
  bpbCache: BpbCache | null;
  correctionPromptsUsed: string[];
};

export async function analyzeCorrectedState(input: AnalyzeCorrectedStateInput): Promise<AnalysisResult> {
  const { gameState, validation, bpbCache, correctionPromptsUsed } = input;
  const knownItemNames = bpbCache?.items.map((item) => item.name) ?? [];
  const correctionQuestions = buildCorrectionQuestions(gameState, validation, knownItemNames);

  if (correctionQuestions.length > 0) {
    return {
      gameState,
      validation,
      correctionQuestions,
      recommendation: null,
    };
  }

  const groundedState: GameState = {
    ...gameState,
    shopItems: gameState.shopItems.map((item) => ({
      ...item,
      groundedBpbId: bpbCache ? findBpbItemByName(bpbCache, item.name)?.id : undefined,
    })),
    backpackItems: gameState.backpackItems.map((item) => ({
      ...item,
      groundedBpbId: bpbCache ? findBpbItemByName(bpbCache, item.name)?.id : undefined,
    })),
  };

  return {
    gameState: groundedState,
    validation,
    correctionQuestions: [],
    recommendation: recommendNextAction({ gameState: groundedState, bpbCache, correctionPromptsUsed }),
  };
}
```

- [ ] **Step 5: Add API routes**

Create `src/app/api/analyze/route.ts`:

```ts
import { NextResponse } from "next/server";
import { readBpbCache } from "@/lib/bpb/store";
import { AnalysisResultSchema, GameStateSchema } from "@/lib/core/schemas";
import { analyzeCorrectedState } from "@/lib/analysis/analyze";
import { saveAnalysisFixture } from "@/lib/fixtures/store";
import { extractGameStateWithVision } from "@/lib/vision/openai";
import { validateScreenshotPixels } from "@/lib/vision/pixel-validator";

export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get("screenshot");
  const correctedState = form.get("correctedState");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "screenshot file is required" }, { status: 400 });
  }

  const image = Buffer.from(await file.arrayBuffer());
  const [bpbCache, validation] = await Promise.all([readBpbCache(), validateScreenshotPixels(image)]);

  const gameState = correctedState
    ? GameStateSchema.parse(JSON.parse(String(correctedState)))
    : await extractGameStateWithVision({
        image,
        mimeType: file.type || "image/png",
        relevantItems: bpbCache?.items.slice(0, 120) ?? [],
      });

  const result = AnalysisResultSchema.parse(
    await analyzeCorrectedState({
      gameState,
      validation,
      bpbCache,
      correctionPromptsUsed: [],
    }),
  );

  await saveAnalysisFixture(result);
  return NextResponse.json(result);
}
```

Create `src/app/api/bpb/refresh/route.ts`:

```ts
import { NextResponse } from "next/server";
import { extractItemIndexFromItemsHtml, normalizeBuildsPayload } from "@/lib/bpb/importer";
import { DEFAULT_BPB_CACHE_PATH, writeBpbCache } from "@/lib/bpb/store";

const ITEMS_URL = "https://bpb-builds.vercel.app/items";
const BUILDS_URL = "https://bpb-builds.vercel.app/api/builds";

export async function POST() {
  const [itemsResponse, buildsResponse] = await Promise.all([fetch(ITEMS_URL), fetch(BUILDS_URL)]);

  if (!itemsResponse.ok || !buildsResponse.ok) {
    return NextResponse.json({ error: "Failed to refresh BPB data" }, { status: 502 });
  }

  const items = extractItemIndexFromItemsHtml(await itemsResponse.text());
  const builds = normalizeBuildsPayload(await buildsResponse.json());

  await writeBpbCache(DEFAULT_BPB_CACHE_PATH, {
    fetchedAt: new Date().toISOString(),
    sourceUrls: [ITEMS_URL, BUILDS_URL],
    items,
    builds,
  });

  return NextResponse.json({ items: items.length, builds: builds.length });
}
```

Create `src/app/api/fixtures/route.ts`:

```ts
import { NextResponse } from "next/server";
import { listAnalysisFixtures } from "@/lib/fixtures/store";

export async function GET() {
  return NextResponse.json({ data: await listAnalysisFixtures() });
}
```

- [ ] **Step 6: Run analysis tests**

Run:

```powershell
npm run test -- src/lib/analysis/analyze.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add src/lib/analysis src/lib/fixtures src/app/api
git commit -m "feat: add analysis API pipeline"
```

## Task 10: Build Phone-First Coaching UI

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/globals.css`
- Create: `src/components/ScreenshotIntake.tsx`
- Create: `src/components/AnalysisStatePanel.tsx`
- Create: `src/components/CorrectionPanel.tsx`
- Create: `src/components/RecommendationPanel.tsx`
- Create: `src/components/HistoryPanel.tsx`

- [ ] **Step 1: Implement screenshot intake component**

Create `src/components/ScreenshotIntake.tsx`:

```tsx
"use client";

type ScreenshotIntakeProps = {
  previewUrl: string | null;
  busy: boolean;
  onFile: (file: File) => void;
  onAnalyze: () => void;
};

export function ScreenshotIntake({ previewUrl, busy, onFile, onAnalyze }: ScreenshotIntakeProps) {
  return (
    <section className="panel">
      <label className="file-drop">
        <input
          accept="image/png,image/jpeg,image/webp"
          type="file"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onFile(file);
          }}
        />
        <span>Choose screenshot</span>
      </label>
      {previewUrl ? <img alt="Uploaded Backpack Battles screenshot" className="screenshot-preview" src={previewUrl} /> : null}
      <button className="primary-button" disabled={!previewUrl || busy} onClick={onAnalyze}>
        {busy ? "Analyzing..." : "Analyze round"}
      </button>
    </section>
  );
}
```

- [ ] **Step 2: Implement state, correction, recommendation, and history panels**

Create `src/components/AnalysisStatePanel.tsx`:

```tsx
import type { AnalysisResult } from "@/lib/core/types";

export function AnalysisStatePanel({ result }: { result: AnalysisResult | null }) {
  if (!result) return null;

  return (
    <section className="panel">
      <h2>Detected State</h2>
      <dl className="state-grid">
        <div><dt>Class</dt><dd>{result.gameState.className}</dd></div>
        <div><dt>Round</dt><dd>{result.gameState.round ?? "Unknown"}</dd></div>
        <div><dt>Gold</dt><dd>{result.gameState.gold ?? "Unknown"}</dd></div>
        <div><dt>Lives</dt><dd>{result.gameState.lives ?? "Unknown"}</dd></div>
      </dl>
      {result.validation.warnings.length ? (
        <ul className="warning-list">{result.validation.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
      ) : null}
    </section>
  );
}
```

Create `src/components/CorrectionPanel.tsx`:

```tsx
import type { AnalysisResult } from "@/lib/core/types";

type CorrectionPanelProps = {
  result: AnalysisResult | null;
  corrections: Record<string, string>;
  setCorrections: (corrections: Record<string, string>) => void;
  onSubmit: () => void;
};

export function CorrectionPanel({ result, corrections, setCorrections, onSubmit }: CorrectionPanelProps) {
  if (!result?.correctionQuestions.length) return null;

  return (
    <section className="panel">
      <h2>Confirm These Reads</h2>
      {result.correctionQuestions.map((question) => (
        <label className="field" key={question.field}>
          <span>{question.question}</span>
          <select value={corrections[question.field] ?? ""} onChange={(event) => setCorrections({ ...corrections, [question.field]: event.target.value })}>
            <option value="">Choose</option>
            {question.options.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </label>
      ))}
      <button className="primary-button" onClick={onSubmit}>Use corrections</button>
    </section>
  );
}
```

Create `src/components/RecommendationPanel.tsx`:

```tsx
import type { Recommendation } from "@/lib/core/types";

export function RecommendationPanel({ recommendation }: { recommendation: Recommendation | null }) {
  if (!recommendation) return null;

  return (
    <section className="panel recommendation">
      <p className="eyebrow">Best Step</p>
      <h2>{recommendation.bestAction.type}: {recommendation.bestAction.target}</h2>
      <p>{recommendation.shortReason}</p>
      <h3>Why</h3>
      <p>{recommendation.bestAction.teachingReason}</p>
      <h3>Next Targets</h3>
      <ul>{recommendation.nextTargets.map((target) => <li key={target}>{target}</li>)}</ul>
      {recommendation.assumptionsMade.length ? (
        <>
          <h3>Assumptions</h3>
          <ul>{recommendation.assumptionsMade.map((assumption) => <li key={assumption}>{assumption}</li>)}</ul>
        </>
      ) : null}
    </section>
  );
}
```

Create `src/components/HistoryPanel.tsx`:

```tsx
import type { AnalysisResult } from "@/lib/core/types";

export function HistoryPanel({ history }: { history: AnalysisResult[] }) {
  if (!history.length) return null;

  return (
    <section className="panel">
      <h2>Recent Fixtures</h2>
      <ul className="history-list">
        {history.map((entry, index) => (
          <li key={`${entry.gameState.className}-${index}`}>
            {entry.gameState.className} round {entry.gameState.round ?? "?"}: {entry.recommendation?.bestAction.target ?? "awaiting correction"}
          </li>
        ))}
      </ul>
    </section>
  );
}
```

- [ ] **Step 3: Wire the page**

Replace `src/app/page.tsx` with:

```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { AnalysisStatePanel } from "@/components/AnalysisStatePanel";
import { CorrectionPanel } from "@/components/CorrectionPanel";
import { HistoryPanel } from "@/components/HistoryPanel";
import { RecommendationPanel } from "@/components/RecommendationPanel";
import { ScreenshotIntake } from "@/components/ScreenshotIntake";
import type { AnalysisResult } from "@/lib/core/types";

export default function HomePage() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [history, setHistory] = useState<AnalysisResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [corrections, setCorrections] = useState<Record<string, string>>({});

  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  async function refreshHistory() {
    const response = await fetch("/api/fixtures");
    const json = await response.json();
    setHistory(json.data ?? []);
  }

  async function analyze(correctedState?: unknown) {
    if (!file) return;
    setBusy(true);
    setError(null);

    try {
      const form = new FormData();
      form.append("screenshot", file);
      if (correctedState) form.append("correctedState", JSON.stringify(correctedState));

      const response = await fetch("/api/analyze", { method: "POST", body: form });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Analysis failed");

      setResult(json);
      await refreshHistory();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Analysis failed");
    } finally {
      setBusy(false);
    }
  }

  function submitCorrections() {
    if (!result) return;
    const correctedState = structuredClone(result.gameState);
    for (const [field, value] of Object.entries(corrections)) {
      if (field === "className") correctedState.className = value;
      const match = field.match(/^shopItems\.(\d+)\.name$/);
      if (match) correctedState.shopItems[Number(match[1])].name = value;
    }
    correctedState.uncertainFields = correctedState.uncertainFields.filter((field) => !(field in corrections));
    void analyze(correctedState);
  }

  useEffect(() => {
    void refreshHistory();
  }, []);

  return (
    <main className="app-shell">
      <header className="topbar">
        <p className="eyebrow">Backpack Battles Mastermind</p>
        <h1>Round coach</h1>
      </header>
      <ScreenshotIntake
        busy={busy}
        previewUrl={previewUrl}
        onAnalyze={() => void analyze()}
        onFile={(nextFile) => {
          setFile(nextFile);
          setResult(null);
          setCorrections({});
        }}
      />
      {error ? <section className="panel error-panel">{error}</section> : null}
      <AnalysisStatePanel result={result} />
      <CorrectionPanel result={result} corrections={corrections} setCorrections={setCorrections} onSubmit={submitCorrections} />
      <RecommendationPanel recommendation={result?.recommendation ?? null} />
      <HistoryPanel history={history} />
    </main>
  );
}
```

- [ ] **Step 4: Expand CSS**

Append to `src/app/globals.css`:

```css
.topbar {
  margin-bottom: 12px;
}

.panel {
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--panel);
  padding: 14px;
  margin-bottom: 12px;
}

.file-drop {
  display: grid;
  place-items: center;
  min-height: 84px;
  border: 1px dashed var(--line);
  border-radius: 8px;
  background: var(--panel-2);
  color: var(--accent);
  font-weight: 700;
}

.file-drop input {
  display: none;
}

.screenshot-preview {
  display: block;
  width: 100%;
  max-height: 360px;
  object-fit: contain;
  margin-top: 12px;
  border-radius: 6px;
  background: #050605;
}

.primary-button {
  width: 100%;
  min-height: 44px;
  margin-top: 12px;
  border: 0;
  border-radius: 6px;
  background: var(--accent);
  color: #1c1608;
  font-weight: 800;
}

.primary-button:disabled {
  opacity: 0.55;
}

.state-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin: 0;
}

.state-grid div,
.field {
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 10px;
  background: rgba(255, 255, 255, 0.03);
}

dt,
.field span {
  display: block;
  color: var(--muted);
  font-size: 0.78rem;
}

dd {
  margin: 2px 0 0;
  font-weight: 700;
}

.field {
  display: grid;
  gap: 6px;
  margin-bottom: 8px;
}

select {
  width: 100%;
  min-height: 40px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--bg);
  color: var(--text);
}

.warning-list,
.history-list,
.recommendation ul {
  padding-left: 18px;
}

.error-panel {
  border-color: rgba(239, 118, 122, 0.5);
  color: var(--danger);
}
```

- [ ] **Step 5: Run tests and build**

Run:

```powershell
npm run test
npm run build
```

Expected: all tests PASS and build succeeds.

- [ ] **Step 6: Commit**

```powershell
git add src/app src/components
git commit -m "feat: add mobile coaching interface"
```

## Task 11: Final Verification And Runtime Check

**Files:**
- Create: `public/manifest.webmanifest`
- Modify: `.gitignore`

- [ ] **Step 1: Add PWA manifest and gitignore**

Create `public/manifest.webmanifest`:

```json
{
  "name": "Backpack Battles Mastermind",
  "short_name": "BPB Mind",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#121614",
  "theme_color": "#1f2a24",
  "icons": []
}
```

Replace `.gitignore` with:

```gitignore
.next/
node_modules/
.env.local
data/fixtures/
```

- [ ] **Step 2: Run full verification**

Run:

```powershell
npm run test
npm run build
npm run refresh:bpb
```

Expected:

- tests PASS;
- build succeeds;
- BPB refresh writes `data/bpb/cache.json` with at least 400 items.

- [ ] **Step 3: Start dev server**

Run:

```powershell
npm run dev
```

Expected: Next.js serves the app at `http://localhost:3000` unless the port is occupied.

- [ ] **Step 4: Browser verification**

Use a browser to open `http://localhost:3000`.

Check:

- page loads with no console errors;
- file picker accepts PNG/JPEG/WEBP;
- screenshot preview fits the viewport;
- Analyze button is disabled before upload and enabled after upload;
- panels do not overlap at mobile width.

- [ ] **Step 5: Commit**

```powershell
git add public/manifest.webmanifest .gitignore data/bpb/cache.json
git commit -m "chore: verify PWA vertical slice"
```

## Self-Review Notes

- Spec coverage: BPB local grounding is covered by Tasks 3 and 4; schemas by Task 2; strategy by Task 5; pixel validation by Task 6; correction loop by Task 7; LLM vision by Task 8; API pipeline and fixture storage by Task 9; mobile PWA UI by Tasks 10 and 11.
- Explicit exclusions from the spec remain excluded: automatic Android capture, native Android packaging, full combat simulation, and perfect item recognition without confirmation.
- Type consistency: shared app data flows through `GameState`, `ValidationReport`, `CorrectionQuestion`, `Recommendation`, and `AnalysisResult` from `src/lib/core/schemas.ts`.
- Accuracy guard: item-specific advice checks `BpbCache` and records assumptions for ungrounded items instead of presenting them as facts.
