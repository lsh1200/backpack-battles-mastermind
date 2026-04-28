# Backpack Battles Mastermind Active Todo

This file is the source of truth for what Codex should do next. It exists to prevent drift while the project grows through bug fixes and feature requests.

## Codex Operating Rules

1. Read `AGENTS.md` first, then this file, then the approved design and implementation plan only as needed for context.
2. Work only on the first task whose status is `ready` or `in_progress`.
3. Before editing code, restate the active task in one or two sentences.
4. If a new bug or idea appears, add it to `Backlog` unless it blocks the active task.
5. If it blocks the active task, add it under `Blockers`, fix the smallest blocking issue, then return to the active task.
6. Do not start backlog work while the active task is unfinished.
7. Use TDD for behavior changes: write a failing test, verify the failure, implement, verify green.
8. Keep commits small. Commit after the active task passes verification.
9. Before marking a task `done`, run the listed verification commands and record the commit hash.
10. If exact game data is uncertain, ask for confirmation instead of inventing item facts or board positions.

## Status Legend

- `ready`: the next task Codex should start.
- `in_progress`: Codex is currently working on it.
- `blocked`: cannot continue without user input or a prerequisite fix.
- `done`: implemented, verified, committed, and pushed.
- `backlog`: recorded for later; do not start until it becomes the active task.

## Current Project State

- Repository: `https://github.com/lsh1200/backpack-battles-mastermind`
- Active branch / PR branch: `codex/task-1-scaffold`
- Latest app-feature commit before active todo setup: `cfb2292 feat: add placement advice to recommendations`
- Existing approved design: `docs/superpowers/specs/2026-04-27-backpack-battles-mastermind-design.md`
- Original implementation plan: `docs/superpowers/plans/2026-04-27-backpack-battles-mastermind.md`
- Current handoff ID useful for manual testing: `9592748f-55a7-4749-908d-1f24df8cb788`

## Active Task

### Task 11: Layout-Aware Placement Optimizer v1

Status: `in_progress`

Goal: Generate placement advice that explicitly says whether the current inventory layout was considered, asks for confirmation when coordinates are missing, renders multiple final layout options, and produces concrete move instructions when enough board data is available.

Problem: The current coach can recommend buys and general placement principles, but it does not yet prove it considered the player's actual board layout, item coordinates, item rotations, occupied cells, or best arrangement generation.

Do Not Drift:

- Do not add new visual polish unless needed to show layout confidence or move instructions.
- Do not invent exact board cells when screenshot recognition did not provide coordinates.
- Do not invent item effects, shapes, or star bonuses that are not grounded in local BPB data or current confirmed state.
- Do not replace the existing buy recommendation logic except where it needs to call placement optimization.
- Do not rely on an LLM as the primary item recognizer. LLM/Codex handoff may help with coarse screen fields or uncertain fallback, but item identity should be framed as grounded/local recognition with confirmation when uncertain.

Expected Files:

- Modify: `src/lib/core/schemas.ts`
- Create: `src/lib/placement/board.ts`
- Create: `src/lib/placement/optimizer.ts`
- Create: `src/lib/placement/optimizer.test.ts`
- Modify: `src/lib/strategy/recommend.ts`
- Modify: `src/lib/strategy/recommend.test.ts`
- Modify: `src/components/RecommendationPanel.tsx`
- Modify or create test: `src/components/RecommendationPanel.test.tsx`
- Modify: `src/app/globals.css`
- Modify: `src/lib/vision/openai.ts`
- Modify: `src/lib/codex-handoff/store.ts`

Required Behavior:

- Recommendation includes a layout confidence field with values like `not-considered`, `needs-confirmation`, or `considered`.
- Recommendation includes a recognition policy field that says whether item names came from local/deterministic recognition, LLM fallback, user correction, or mixed sources.
- If backpack items lack usable `x` and `y` coordinates, recommendation says layout confidence is low and asks the user to confirm item positions.
- If backpack items have usable coordinates, recommendation includes exact move instructions based on the current layout.
- Recommendation includes two or more layout options when a layout can be generated, because there is usually no single best arrangement.
- UI renders final layout options as a board/grid, not only as text.
- Codex and OpenAI vision prompts must say not to identify item names from raw visual guessing; they should use grounded/local candidates and mark uncertain item names for confirmation.
- For the Ranger round-one case, the optimizer should prioritize:
  - keep `Wooden Sword` active in bag space;
  - place `Broom` as a second active weapon;
  - place `Stone` adjacent to `Wooden Sword` or `Broom`;
  - place `Banana` so it supports stamina without blocking weapon adjacency;
  - place `Shiny Shell` and `Walrus Tusk` only after weapon and stamina layout is stable.
- UI shows:
  - `Layout Confidence`
  - `Placement`
  - exact move instructions or confirmation request

Implementation Steps:

- [x] Step 1: Mark this task `in_progress` in this file and commit only after the feature is verified.
- [x] Step 2: Add failing schema tests for layout confidence and placement instructions.
- [x] Step 3: Add `src/lib/placement/board.ts` with focused types/helpers for board items that have optional coordinates.
- [x] Step 4: Add failing optimizer tests for missing coordinates: it must return `needs-confirmation`.
- [x] Step 5: Add failing optimizer tests for a simple Ranger board with coordinates: it must return concrete move instructions.
- [x] Step 6: Implement the minimal optimizer that passes those tests without claiming unsupported item facts.
- [x] Step 7: Wire the optimizer into `src/lib/strategy/recommend.ts`.
- [x] Step 8: Update `RecommendationPanel` so the user can see whether layout was considered.
- [x] Step 9: Update LLM/Codex prompts so they do not present the LLM as primary item recognition.
- [x] Step 10: Render layout options in the UI as boards/grids.
- [x] Step 11: Run targeted tests for schemas, placement optimizer, strategy, recommendation panel, and prompt policy.
- [x] Step 12: Run full verification:

```powershell
npm.cmd run lint
npx.cmd tsc --noEmit -p tsconfig.json
npm.cmd run test
npm.cmd run build
```

- [x] Step 13: Browser-check the handoff resume flow at `http://127.0.0.1:3000` with handoff ID `9592748f-55a7-4749-908d-1f24df8cb788`.
- [ ] Step 14: Commit with message `feat: add layout-aware placement optimizer`.
- [ ] Step 15: Push `codex/task-1-scaffold`.
- [ ] Step 16: Mark this task `done` and record the commit hash.

Acceptance Checklist:

- [x] The app no longer implies it generated an optimized layout when coordinates are missing.
- [x] The app asks for board-position confirmation when current layout cannot be trusted.
- [x] The app gives concrete move instructions when board coordinates are available.
- [x] The app renders more than one final layout option when a generated layout is available.
- [x] The app clearly states item recognition is grounded/local-first, with LLM only as fallback or handoff aid.
- [x] Tests cover both missing-coordinate and coordinate-present paths.
- [x] Full verification commands pass.
- [x] Browser resume flow displays layout confidence and placement guidance.

Verification Evidence:

- `npm.cmd run lint` passed.
- `npx.cmd tsc --noEmit -p tsconfig.json` passed.
- `npm.cmd run test` passed: 15 files, 68 tests.
- `npm.cmd run build` passed.
- Browser resume check passed for handoff `9592748f-55a7-4749-908d-1f24df8cb788`: no overlay, no console errors, layout confidence shown, item recognition shown as `llm-fallback`, and two layout options rendered.

## Blockers

No active blockers.

## Backlog

These are real ideas, but they must not interrupt the active task unless they become blockers.

### Task 12: Deterministic Item Recognition Primary Pipeline

Status: `backlog`

Goal: Replace LLM item-name reading with deterministic local item recognition as the primary path. Use screenshot regions, BPB item icons/templates, pixel/feature matching, confidence scoring, and targeted user confirmation when confidence is low.

### Task 13: Board Position Correction UI

Status: `backlog`

Goal: Let the user correct item positions when screenshot recognition cannot confidently locate the backpack grid.

### Task 14: BPB Item Shape and Star Data Enrichment

Status: `backlog`

Goal: Extend the local BPB cache with item shapes, rotations, and star/effect metadata when the source data can provide it.

### Task 15: Visual Board Overlay

Status: `backlog`

Goal: Show the recommended arrangement as an overlay or simple grid diagram so the user can copy it in-game.

### Task 16: Recognition Learning Loop

Status: `backlog`

Goal: Store user-confirmed item names and positions from Android screenshots to improve recognition for Henry's device layout over time.
