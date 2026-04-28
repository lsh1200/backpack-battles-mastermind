import type { BackpackItem, GameState } from "@/lib/core/types";

export type Coordinate = {
  x: number;
  y: number;
};

export type BoardDimensions = {
  width: number;
  height: number;
};

export type BagOccupancy = "inside-bag" | "outside-bag" | "partial" | "unknown";

export type ReadableBackpackItem = BackpackItem & Coordinate;

export type PlacedBagItem = ReadableBackpackItem & {
  footprint: NonNullable<BackpackItem["footprint"]>;
};

export type BagAwareBoard = {
  fullBoard: BoardDimensions;
  bags: PlacedBagItem[];
  activeBagCells: Coordinate[];
  usableCellKeys: Set<string>;
  unusableCellKeys: Set<string>;
  missingBagData: string[];
};

const DEFAULT_BOARD: BoardDimensions = { width: 10, height: 6 };

export function hasCoordinates(item: BackpackItem): item is ReadableBackpackItem {
  return item.x !== undefined && item.y !== undefined;
}

function coordinateKey(coordinate: Coordinate): string {
  return `${coordinate.x},${coordinate.y}`;
}

export function isBagItem(item: BackpackItem, gameState: GameState): boolean {
  return item.itemKind === "bag" || item.name === gameState.bagChoice || /\bbag\b/i.test(item.name);
}

function translateFootprint(item: PlacedBagItem): Coordinate[] {
  return item.footprint.cells.map((cell) => ({ x: item.x + cell.x, y: item.y + cell.y }));
}

function fullBoardCells(dimensions: BoardDimensions): Coordinate[] {
  const cells: Coordinate[] = [];

  for (let y = 0; y < dimensions.height; y += 1) {
    for (let x = 0; x < dimensions.width; x += 1) {
      cells.push({ x, y });
    }
  }

  return cells;
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

export function bagAwareBoard(gameState: GameState, fullBoard: BoardDimensions = DEFAULT_BOARD): BagAwareBoard {
  const bagCandidates = backpackItems(gameState).filter((item) => isBagItem(item, gameState));
  const missingBagData = bagCandidates.flatMap((item) => {
    const missing: string[] = [];
    if (!hasCoordinates(item)) {
      missing.push(`${item.name} placement is unknown.`);
    }
    if (!item.footprint || item.footprint.source === "unknown") {
      missing.push(`${item.name} footprint is unknown.`);
    }
    return missing;
  });
  const bags = bagCandidates.filter(
    (item): item is PlacedBagItem => hasCoordinates(item) && item.footprint !== undefined,
  );
  const usableCellKeys = new Set<string>();
  const activeBagCells = bags
    .flatMap(translateFootprint)
    .filter((cell) => cell.x >= 0 && cell.y >= 0 && cell.x < fullBoard.width && cell.y < fullBoard.height)
    .filter((cell) => {
      const key = coordinateKey(cell);
      if (usableCellKeys.has(key)) {
        return false;
      }
      usableCellKeys.add(key);
      return true;
    });
  const unusableCellKeys = new Set(
    fullBoardCells(fullBoard)
      .map(coordinateKey)
      .filter((key) => !usableCellKeys.has(key)),
  );

  return {
    fullBoard,
    bags,
    activeBagCells,
    usableCellKeys,
    unusableCellKeys,
    missingBagData,
  };
}

export function itemOccupiedCells(item: BackpackItem): Coordinate[] {
  if (!hasCoordinates(item)) {
    return [];
  }

  if (!item.footprint) {
    return [{ x: item.x, y: item.y }];
  }

  return item.footprint.cells.map((cell) => ({ x: item.x + cell.x, y: item.y + cell.y }));
}

export function classifyItemBagOccupancy(item: BackpackItem, board: BagAwareBoard): BagOccupancy {
  const occupiedCells = itemOccupiedCells(item);
  if (occupiedCells.length === 0 || board.activeBagCells.length === 0) {
    return "unknown";
  }

  const insideCount = occupiedCells.filter((cell) => board.usableCellKeys.has(coordinateKey(cell))).length;
  if (insideCount === occupiedCells.length) {
    return "inside-bag";
  }

  if (insideCount === 0) {
    return "outside-bag";
  }

  return "partial";
}

export function isCellInsideKnownBagSpace(coordinate: Coordinate, board: BagAwareBoard): boolean {
  return board.usableCellKeys.has(coordinateKey(coordinate));
}
