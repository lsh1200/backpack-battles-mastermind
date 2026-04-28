import type { BackpackItem, GameState } from "@/lib/core/types";

export type Coordinate = {
  x: number;
  y: number;
};

export type ReadableBackpackItem = BackpackItem & Coordinate;

export function hasCoordinates(item: BackpackItem): item is ReadableBackpackItem {
  return item.x !== undefined && item.y !== undefined;
}

export function backpackItems(gameState: GameState): BackpackItem[] {
  return [...gameState.backpackItems, ...gameState.storageItems].filter((item) => item.location === "bag");
}

export function readableBackpackItems(gameState: GameState): ReadableBackpackItem[] {
  return backpackItems(gameState).filter(hasCoordinates);
}

export function allBackpackItemsHaveCoordinates(gameState: GameState): boolean {
  const items = backpackItems(gameState);
  return items.length > 0 && items.every(hasCoordinates);
}

export function currentPositionByName(gameState: GameState): Map<string, Coordinate> {
  return new Map(readableBackpackItems(gameState).map((item) => [item.name, { x: item.x, y: item.y }]));
}

export function coordinateLabel(coordinate: Coordinate): string {
  return `(${coordinate.x}, ${coordinate.y})`;
}
