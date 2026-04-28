# Backpack Battles Grid Guides

This folder keeps user-provided screenshot references for inventory-grid detection.

## round1-inventory-grid-guide

- Raw image path: `data/grid-guides/round1-inventory-grid-guide.png`
- Overlay check: `data/grid-guides/round1-inventory-grid-guide-overlay.png`
- Measurement data: `data/grid-guides/round1-inventory-grid-guide.json`
- Source: user-attached in-game screenshot from April 28, 2026.

## round1-full-inventory-anchor

- Raw image path: `data/grid-guides/round1-full-inventory-anchor.jpg`
- Purpose: regression fixture for detecting the full 9x7 inventory origin when the brighter bag cluster would otherwise be chosen.
- Expected inventory grid: 9x7 at `(134, 26)` with 46 px cells.
