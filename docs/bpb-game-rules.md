# Backpack Battles Rules Reference

This file is the project reference for Backpack Battles placement behavior used by the recommendation engine.

## Source Notes

- BPB source checked: `https://bpb-builds.vercel.app/` and its client chunks from the local BPB cache workflow.
- Local cache fields used by this app: `data/bpb/cache.json` item `shape`, `gridWidth`, `gridHeight`, `type`, `sockets`, `extraShapes`, `rowOffset`, and `colOffset`.
- BPB client behavior observed on April 28, 2026: rotation is handled in 90 degree steps, and occupied cells are derived only from shape value `1`.

## Shape Values

BPB item shapes are matrices of numbers.

- `0`: Empty space inside the item's bounding box.
- `1`: Physical item or bag cell. This is the only value that occupies backpack space.
- `2`: Star marker. This affects item adjacency/effects, but does not occupy space.
- `3`: Diamond marker. This is an effect marker, not occupied space.
- `4`: Tertiary marker. This is an effect marker, not occupied space.
- `5`: Lightning marker. This is an effect marker, not occupied space.

Example: Banana is a 4x4 shape matrix, but only three cells are physical occupied cells:

```json
[
  [0, 2, 0, 0],
  [2, 1, 2, 0],
  [2, 1, 1, 2],
  [0, 2, 2, 0]
]
```

The Banana body occupies the three `1` cells. The `2` cells are star markers and should be shown visually, but they must not block placement.

## Bags

- Bags are items with `type: "Bag"` or names/classifications that identify them as bags.
- A bag's `1` cells create active backpack cells where non-bag items may be placed.
- Bag marker values, if present, should not be treated as usable inventory cells unless BPB data confirms they are physical `1` cells.
- Items must fit all of their physical `1` cells inside active bag cells.

## Item Placement

- Non-bag items consume only their `1` cells.
- Marker cells are visual/effect information and can overlap empty board space; they do not consume storage space.
- If an item has no known shape, treat it as a conservative 1x1 physical item until BPB data or user confirmation is available.
- If an item cannot fit into the known active bag cells, it should be shown as storage/bench rather than drawn as a fake 1x1 placement.

## Rotation

- Items and bags can be rotated freely in 90 degree increments: 0, 90, 180, and 270 degrees.
- Items are not mirrored.
- Rotation applies to the whole shape matrix, including physical cells and markers.
- Duplicate rotations can be skipped for symmetrical shapes.

## Current Task 17 UI Rules

- Show a visual board instead of making the user reason from coordinates alone.
- Show physical cells and marker cells differently.
- Show storage/bench items with their real footprints when they do not fit.
- Text instructions may include coordinates as backup, but the visual footprint should be the primary placement explanation.
- Do not claim a full exact layout when bag placement or bag footprint is unknown.
