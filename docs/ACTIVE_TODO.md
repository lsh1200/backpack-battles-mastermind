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

Status: `ready`

Goal: Generate placement advice that explicitly says whether the current inventory layout was considered, asks for confirmation when coordinates are missing, and produces concrete move instructions when enough board data is available.

Problem: The current coach can recommend buys and general placement principles, but it does not yet prove it considered the player's actual board layout, item coordinates, item rotations, occupied cells, or best arrangement generation.

Do Not Drift:

- Do not add new visual polish unless needed to show layout confidence or move instructions.
- Do not invent exact board cells when screenshot recognition did not provide coordinates.
- Do not invent item effects, shapes, or star bonuses that are not grounded in local BPB data or current confirmed state.
- Do not replace the existing buy recommendation logic except where it needs to call placement optimization.

Expected Files:

- Modify: `src/lib/core/schemas.ts`
- Create: `src/lib/placement/board.ts`
- Create: `src/lib/placement/optimizer.ts`
- Create: `src/lib/placement/optimizer.test.ts`
- Modify: `src/lib/strategy/recommend.ts`
- Modify: `src/lib/strategy/recommend.test.ts`
- Modify: `src/components/RecommendationPanel.tsx`
- Modify or create test: `src/components/RecommendationPanel.test.tsx`

Required Behavior:

- Recommendation includes a layout confidence field with values like `not-considered`, `needs-confirmation`, or `considered`.
- If backpack items lack usable `x` and `y` coordinates, recommendation says layout confidence is low and asks the user to confirm item positions.
- If backpack items have usable coordinates, recommendation includes exact move instructions based on the current layout.
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

- [ ] Step 1: Mark this task `in_progress` in this file and commit only after the feature is verified.
- [ ] Step 2: Add failing schema tests for layout confidence and placement instructions.
- [ ] Step 3: Add `src/lib/placement/board.ts` with focused types/helpers for board items that have optional coordinates.
- [ ] Step 4: Add failing optimizer tests for missing coordinates: it must return `needs-confirmation`.
- [ ] Step 5: Add failing optimizer tests for a simple Ranger board with coordinates: it must return concrete move instructions.
- [ ] Step 6: Implement the minimal optimizer that passes those tests without claiming unsupported item facts.
- [ ] Step 7: Wire the optimizer into `src/lib/strategy/recommend.ts`.
- [ ] Step 8: Update `RecommendationPanel` so the user can see whether layout was considered.
- [ ] Step 9: Run targeted tests for schemas, placement optimizer, strategy, and recommendation panel.
- [ ] Step 10: Run full verification:

```powershell
npm.cmd run lint
npx.cmd tsc --noEmit -p tsconfig.json
npm.cmd run test
npm.cmd run build
```

- [ ] Step 11: Browser-check the handoff resume flow at `http://127.0.0.1:3000` with handoff ID `9592748f-55a7-4749-908d-1f24df8cb788`.
- [ ] Step 12: Commit with message `feat: add layout-aware placement optimizer`.
- [ ] Step 13: Push `codex/task-1-scaffold`.
- [ ] Step 14: Mark this task `done` and record the commit hash.

Acceptance Checklist:

- [ ] The app no longer implies it generated an optimized layout when coordinates are missing.
- [ ] The app asks for board-position confirmation when current layout cannot be trusted.
- [ ] The app gives concrete move instructions when board coordinates are available.
- [ ] Tests cover both missing-coordinate and coordinate-present paths.
- [ ] Full verification commands pass.
- [ ] Browser resume flow displays layout confidence and placement guidance.

## Blockers

No active blockers.

## Backlog

These are real ideas, but they must not interrupt the active task unless they become blockers.

### Task 12: Board Position Correction UI

Status: `backlog`

Goal: Let the user correct item positions when screenshot recognition cannot confidently locate the backpack grid.

### Task 13: BPB Item Shape and Star Data Enrichment

Status: `backlog`

Goal: Extend the local BPB cache with item shapes, rotations, and star/effect metadata when the source data can provide it.

### Task 14: Visual Board Overlay

Status: `backlog`

Goal: Show the recommended arrangement as an overlay or simple grid diagram so the user can copy it in-game.

### Task 15: Recognition Learning Loop

Status: `backlog`

Goal: Store user-confirmed item names and positions from Android screenshots to improve recognition for Henry's device layout over time.
