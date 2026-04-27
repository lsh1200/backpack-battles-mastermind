# Backpack Battles Mastermind - Codex Start Note

Start here:

1. Read the approved design: `docs/superpowers/specs/2026-04-27-backpack-battles-mastermind-design.md`
2. Execute the implementation plan: `docs/superpowers/plans/2026-04-27-backpack-battles-mastermind.md`
3. The next real work is Task 1 in that plan: scaffold the Next.js PWA.

Important context:

- Goal: a phone-friendly Backpack Battles coach for Android screenshots.
- Architecture: LLM vision + deterministic pixel checks + local BPB item/build cache + targeted correction loop.
- Accuracy priority: do not let the LLM invent item facts. Ground item-specific advice in local BPB data.
- Source transcript: `Default_Backpack Battles 101! Beginner & Interme.txt`
- BPB source: https://bpb-builds.vercel.app/
- GitHub remote: https://github.com/lsh1200/backpack-battles-mastermind

Implementation preference:

- Follow the plan task-by-task.
- Keep commits small.
- Run the tests/build commands listed in each task before claiming completion.
