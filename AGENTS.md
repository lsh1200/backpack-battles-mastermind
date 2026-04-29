# Backpack Battles Mastermind - Codex Start Note

Start here every session:

1. Read `docs/ACTIVE_TODO.md`.
2. Work only on the first task marked `ready` or `in_progress`.
3. Use the approved design for product context: `docs/superpowers/specs/2026-04-27-backpack-battles-mastermind-design.md`.
4. Use the original implementation plan for historical context: `docs/superpowers/plans/2026-04-27-backpack-battles-mastermind.md`.
5. Do not skip ahead to backlog items unless the active task is blocked and the user approves the change in priority.

## Current State

- GitHub remote: `https://github.com/lsh1200/backpack-battles-mastermind`
- Active branch / PR branch: `codex/task-1-scaffold`
- Latest app-feature commit before active todo setup: `cfb2292 feat: add placement advice to recommendations`
- Current active task: `Task 11: Layout-Aware Placement Optimizer v1` in `docs/ACTIVE_TODO.md`
- Useful manual handoff ID: `9592748f-55a7-4749-908d-1f24df8cb788`

## Project Goal

Build a phone-friendly Backpack Battles coach for Android screenshots. The coach should read the current round, identify the board/shop state, ground item facts in local BPB data, ask for confirmations when uncertain, and explain the best action plus the best placement so Henry can learn quickly.

## Architecture Guardrails

- Architecture: LLM vision + deterministic pixel checks + local BPB item/build cache + targeted correction loop + layout-aware placement optimizer.
- Accuracy priority: do not let the LLM invent item facts. Ground item-specific advice in local BPB data.
- If exact board layout is uncertain, ask for confirmation instead of pretending.
- Prefer small, testable changes and small commits.
- Use TDD for behavior changes.

## Important Resources

- Source transcript: `Default_Backpack Battles 101! Beginner & Interme.txt`
- BPB source: `https://bpb-builds.vercel.app/`
- Current active todo: `docs/ACTIVE_TODO.md`
- Approved design: `docs/superpowers/specs/2026-04-27-backpack-battles-mastermind-design.md`
- Original implementation plan: `docs/superpowers/plans/2026-04-27-backpack-battles-mastermind.md`

## Session Boot Commands

Before starting code work on another machine:

```powershell
git fetch origin
git checkout codex/task-1-scaffold
npm install
npm.cmd run test
npm.cmd run lint
npx.cmd tsc --noEmit -p tsconfig.json
npm.cmd run build
```

## Drift Control

When the user reports a bug or requests a feature:

1. Check whether it belongs to the active task in `docs/ACTIVE_TODO.md`.
2. If yes, handle it inside the active task.
3. If no, add it to the backlog in `docs/ACTIVE_TODO.md`.
4. If it blocks the active task, add it under `Blockers`, fix only the blocker, then return to the active task.
5. Before claiming completion, run the active task's verification commands and record the commit hash in `docs/ACTIVE_TODO.md`.
