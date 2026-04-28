import type { GameState, Recommendation } from "@/lib/core/types";
import {
  allBackpackItemsHaveCoordinates,
  bagAwareBoard,
  classifyItemBagOccupancy,
  coordinateLabel,
  currentPositionByName,
  isBagItem,
  type BagAwareBoard,
} from "./board";

export { bagAwareBoard, classifyItemBagOccupancy, type BagAwareBoard } from "./board";

type LayoutConfidence = Recommendation["layoutConfidence"];
type LayoutOption = Recommendation["layoutOptions"][number];

export type PlacementPlan = Pick<Recommendation, "layoutConfidence" | "placementAdvice" | "layoutOptions">;

type OptimizePlacementInput = {
  gameState: GameState;
  targetItems: string[];
  itemShapes?: Record<string, number[][]>;
};

type PlannedCell = LayoutOption["cells"][number];
type BenchItem = LayoutOption["benchItems"][number];
type ShapeCell = { x: number; y: number };
type ShapePlacement = {
  shape: number[][];
  rotation: number;
  width: number;
  height: number;
};

const TEMPO_WEAPON_CELLS: PlannedCell[] = [
  { item: "Wooden Sword", x: 1, y: 1, width: 1, height: 1, role: "primary weapon" },
  { item: "Broom", x: 2, y: 1, width: 1, height: 1, role: "second weapon" },
  { item: "Stone", x: 1, y: 0, width: 1, height: 1, role: "weapon damage adjacency" },
  { item: "Banana", x: 0, y: 2, width: 1, height: 1, role: "stamina support" },
  { item: "Shiny Shell", x: 3, y: 0, width: 1, height: 1, role: "cheap utility" },
  { item: "Walrus Tusk", x: 3, y: 1, width: 1, height: 1, role: "damage utility" },
  { item: "Lucky Clover", x: 0, y: 1, width: 1, height: 1, role: "luck support" },
];

const PREFERRED_CELL_BY_ITEM = new Map(TEMPO_WEAPON_CELLS.map((cell) => [cell.item, cell]));

const STAMINA_SAFE_CELLS: PlannedCell[] = [
  { item: "Wooden Sword", x: 1, y: 1, width: 1, height: 1, role: "primary weapon" },
  { item: "Broom", x: 2, y: 1, width: 1, height: 1, role: "second weapon" },
  { item: "Banana", x: 1, y: 2, width: 1, height: 1, role: "protected stamina support" },
  { item: "Stone", x: 2, y: 0, width: 1, height: 1, role: "weapon damage adjacency" },
  { item: "Lucky Clover", x: 0, y: 1, width: 1, height: 1, role: "luck support" },
  { item: "Shiny Shell", x: 0, y: 2, width: 1, height: 1, role: "cheap utility" },
  { item: "Walrus Tusk", x: 3, y: 1, width: 1, height: 1, role: "damage utility" },
];

const ROLE_BY_ITEM = new Map(
  [...TEMPO_WEAPON_CELLS, ...STAMINA_SAFE_CELLS].map((cell) => [cell.item, cell.role] as const),
);

function relevantNames(gameState: GameState, targetItems: string[]): Set<string> {
  return new Set([
    ...gameState.backpackItems
      .filter((item) => item.location === "bag" && !isBagItem(item, gameState))
      .map((item) => item.name),
    ...targetItems,
  ]);
}

function cellKey(cell: { x: number; y: number }): string {
  return `${cell.x},${cell.y}`;
}

function resolvedShape(shape: number[][] | undefined): number[][] {
  return shape?.length ? shape : [[1]];
}

function rotateShape(shape: number[][], rotation: number): number[][] {
  const turns = (((rotation / 90) % 4) + 4) % 4;
  let rotated = shape;

  for (let turn = 0; turn < turns; turn += 1) {
    const rows = rotated.length;
    const columns = Math.max(1, ...rotated.map((row) => row.length));
    rotated = Array.from({ length: columns }, (_, x) =>
      Array.from({ length: rows }, (__, y) => rotated[rows - y - 1]?.[x] ?? 0),
    );
  }

  return rotated;
}

function trimShapeToOccupiedCells(shape: number[][]): number[][] {
  const occupied = shapeCells(shape);
  if (occupied.length === 0) {
    return [[1]];
  }

  const minX = Math.min(...occupied.map((cell) => cell.x));
  const maxX = Math.max(...occupied.map((cell) => cell.x));
  const minY = Math.min(...occupied.map((cell) => cell.y));
  const maxY = Math.max(...occupied.map((cell) => cell.y));

  return Array.from({ length: maxY - minY + 1 }, (_, y) =>
    Array.from({ length: maxX - minX + 1 }, (__, x) => shape[minY + y]?.[minX + x] ?? 0),
  );
}

function normalizedShape(shape: number[][] | undefined, rotation: number): number[][] {
  return trimShapeToOccupiedCells(rotateShape(resolvedShape(shape), rotation));
}

function shapeCells(shape: number[][] | undefined): ShapeCell[] {
  const matrix = resolvedShape(shape);
  return matrix.flatMap((row, y) => row.flatMap((value, x) => (value === 1 ? [{ x, y }] : [])));
}

function shapeWidth(shape: number[][] | undefined): number {
  return Math.max(1, ...(shape ?? [[1]]).map((row) => row.length));
}

function shapeHeight(shape: number[][] | undefined): number {
  return Math.max(1, shape?.length ?? 1);
}

function activeCellsByReadingOrder(board: BagAwareBoard): { x: number; y: number }[] {
  return [...board.activeBagCells].sort((left, right) => left.y - right.y || left.x - right.x);
}

function shapePlacements(shape: number[][] | undefined): ShapePlacement[] {
  const seen = new Set<string>();

  return [0, 90, 180, 270].flatMap((rotation) => {
    const rotatedShape = normalizedShape(shape, rotation);
    const key = JSON.stringify(rotatedShape);
    if (seen.has(key)) {
      return [];
    }

    seen.add(key);
    return [
      {
        shape: rotatedShape,
        rotation,
        width: shapeWidth(rotatedShape),
        height: shapeHeight(rotatedShape),
      },
    ];
  });
}

function plannedCellFor(item: string, coordinate: { x: number; y: number }, placement: ShapePlacement): PlannedCell {
  return {
    item,
    x: coordinate.x,
    y: coordinate.y,
    width: placement.width,
    height: placement.height,
    shape: placement.shape,
    ...(placement.rotation ? { rotation: placement.rotation } : {}),
    ...(ROLE_BY_ITEM.get(item) ? { role: ROLE_BY_ITEM.get(item) } : {}),
  };
}

function occupiedKeysFor(origin: { x: number; y: number }, shape: number[][] | undefined): string[] {
  return shapeCells(shape).map((cell) => cellKey({ x: origin.x + cell.x, y: origin.y + cell.y }));
}

function canPlaceAt(
  origin: { x: number; y: number },
  shape: number[][] | undefined,
  board: BagAwareBoard,
  occupiedKeys: Set<string>,
): boolean {
  const keys = occupiedKeysFor(origin, shape);
  return keys.length > 0 && keys.every((key) => board.usableCellKeys.has(key) && !occupiedKeys.has(key));
}

function firstPlacementFor(
  itemName: string,
  shape: number[][] | undefined,
  board: BagAwareBoard,
  gameState: GameState,
  occupiedKeys: Set<string>,
): { coordinate: { x: number; y: number }; placement: ShapePlacement } | null {
  const placements = shapePlacements(shape);
  const current = gameState.backpackItems.find((item) => item.name === itemName);
  const currentCoordinate =
    current?.x !== undefined && current.y !== undefined ? { x: current.x, y: current.y } : undefined;
  if (currentCoordinate) {
    const currentPlacement = placements.find((placement) => canPlaceAt(currentCoordinate, placement.shape, board, occupiedKeys));
    if (currentPlacement) {
      return { coordinate: currentCoordinate, placement: currentPlacement };
    }
  }

  const preferred = PREFERRED_CELL_BY_ITEM.get(itemName);
  if (preferred) {
    const preferredPlacement = placements.find((placement) => canPlaceAt(preferred, placement.shape, board, occupiedKeys));
    if (preferredPlacement) {
      return { coordinate: preferred, placement: preferredPlacement };
    }
  }

  for (const cell of activeCellsByReadingOrder(board)) {
    const placement = placements.find((candidate) => canPlaceAt(cell, candidate.shape, board, occupiedKeys));
    if (placement) {
      return { coordinate: cell, placement };
    }
  }

  return null;
}

function cellsForPriority(input: {
  items: string[];
  names: Set<string>;
  board: BagAwareBoard;
  gameState: GameState;
  itemShapes: Record<string, number[][]>;
}): { cells: PlannedCell[]; benchItems: BenchItem[] } {
  const activeCells = activeCellsByReadingOrder(input.board);
  const occupiedKeys = new Set<string>();
  const cells: PlannedCell[] = [];
  const benchItems: BenchItem[] = [];

  for (const itemName of input.items) {
    if (!input.names.has(itemName)) {
      continue;
    }

    const shape = input.itemShapes[itemName];
    const candidate = firstPlacementFor(itemName, shape, input.board, input.gameState, occupiedKeys);
    if (!candidate || activeCells.length === 0) {
      const preview = shapePlacements(shape)[0];
      benchItems.push({
        item: itemName,
        reason: "Keep in storage for now; it does not fit in the known active bag space without blocking higher-priority items.",
        ...(preview ? { shape: preview.shape, ...(preview.rotation ? { rotation: preview.rotation } : {}) } : {}),
      });
      continue;
    }

    cells.push(plannedCellFor(itemName, candidate.coordinate, candidate.placement));
    for (const key of occupiedKeysFor(candidate.coordinate, candidate.placement.shape)) {
      occupiedKeys.add(key);
    }
  }

  return { cells, benchItems };
}

function targetAction(cell: PlannedCell): string {
  if (cell.item === "Broom") {
    return `Place ${cell.item} at ${coordinateLabel(cell)}${cell.rotation ? ` rotated ${cell.rotation} degrees` : ""} as your second active weapon.`;
  }

  if (cell.item === "Stone") {
    return `Place ${cell.item} at ${coordinateLabel(cell)} touching Wooden Sword or Broom.`;
  }

  if (cell.item === "Banana") {
    return `Place ${cell.item} at ${coordinateLabel(cell)}${cell.rotation ? ` rotated ${cell.rotation} degrees` : ""} for stamina support without blocking weapons.`;
  }

  return `Place ${cell.item} at ${coordinateLabel(cell)}${cell.rotation ? ` rotated ${cell.rotation} degrees` : ""}.`;
}

function movesFor(cells: PlannedCell[], gameState: GameState, layoutConfidence: LayoutConfidence): string[] {
  const currentPositions = currentPositionByName(gameState);
  const moves = cells.map((cell) => {
    const current = currentPositions.get(cell.item);
    if (!current) {
      return targetAction(cell);
    }

    if (current.x === cell.x && current.y === cell.y) {
      return `Keep ${cell.item} at ${coordinateLabel(current)}.`;
    }

    return `Move ${cell.item} from ${coordinateLabel(current)} to ${coordinateLabel(cell)}.`;
  });

  if (layoutConfidence === "needs-confirmation") {
    return ["Confirm current item positions before treating these as exact moves.", ...moves];
  }

  return moves;
}

function buildOption(input: {
  id: string;
  title: string;
  score: number;
  summary: string;
  tradeoffs: string[];
  cells: PlannedCell[];
  benchItems: BenchItem[];
  gameState: GameState;
  layoutConfidence: LayoutConfidence;
}): LayoutOption {
  return {
    id: input.id,
    title: input.title,
    score: input.score,
    summary: input.summary,
    moves: movesFor(input.cells, input.gameState, input.layoutConfidence),
    tradeoffs: input.tradeoffs,
    cells: input.cells,
    benchItems: input.benchItems,
  };
}

export function optimizePlacement(input: OptimizePlacementInput): PlacementPlan {
  const names = relevantNames(input.gameState, input.targetItems);
  const board = bagAwareBoard(input.gameState);

  if (board.missingBagData.length > 0 || board.activeBagCells.length === 0) {
    return {
      layoutConfidence: "needs-confirmation",
      placementAdvice: [
        "Confirm bag placement and bag shape before treating layout moves as exact.",
        ...board.missingBagData,
      ],
      layoutOptions: [],
    };
  }

  const itemShapes = input.itemShapes ?? {};
  const tempoPriority = ["Wooden Sword", "Stone", "Lucky Clover", "Walrus Tusk", "Broom", "Banana", "Shiny Shell"];
  const staminaPriority = ["Wooden Sword", "Lucky Clover", "Stone", "Walrus Tusk", "Banana", "Broom", "Shiny Shell"];
  const tempoPlan = cellsForPriority({
    items: tempoPriority,
    names,
    board,
    gameState: input.gameState,
    itemShapes,
  });
  const staminaPlan = cellsForPriority({
    items: staminaPriority,
    names,
    board,
    gameState: input.gameState,
    itemShapes,
  });
  const tempoCells = tempoPlan.cells;
  const staminaCells = staminaPlan.cells;

  if (tempoCells.length === 0 && staminaCells.length === 0) {
    return {
      layoutConfidence: "not-considered",
      placementAdvice: ["No grounded layout option was generated for the current visible items."],
      layoutOptions: [],
    };
  }

  const outsideItems = input.gameState.backpackItems.filter(
    (item) => !isBagItem(item, input.gameState) && classifyItemBagOccupancy(item, board) === "outside-bag",
  );
  const unknownItems = input.gameState.backpackItems.filter(
    (item) => !isBagItem(item, input.gameState) && classifyItemBagOccupancy(item, board) === "unknown",
  );
  const layoutConfidence: LayoutConfidence =
    allBackpackItemsHaveCoordinates(input.gameState) && unknownItems.length === 0 ? "considered" : "needs-confirmation";
  const placementAdvice =
    layoutConfidence === "considered"
      ? [
          "Known bag space was considered with BPB item footprints when generating these options.",
          ...(tempoCells.length < names.size
            ? [`Known active bag space fits ${tempoCells.length} of ${names.size} relevant items by real BPB shape; keep the rest in storage until more bag space is placed.`]
            : []),
          ...(outsideItems.length
            ? [`${outsideItems.map((item) => item.name).join(", ")} appears outside known active bag space; confirm storage or bag placement.`]
            : []),
          "Option 1 maximizes early weapon tempo by keeping Wooden Sword and Broom active with Stone adjacency.",
          "Option 2 protects Banana support first, then fits damage and utility pieces around the weapons.",
        ]
      : [
          "Layout confidence is low because item positions or active bag cells need confirmation.",
          "Option 1 keeps Wooden Sword and Broom as active weapons, with Stone touching a weapon.",
          "Option 2 gives Banana a safer support position first, then fits damage/utility pieces around the weapons.",
        ];

  return {
    layoutConfidence,
    placementAdvice,
    layoutOptions: [
      buildOption({
        id: "tempo-weapons",
        title: "Tempo Weapons",
        score: 92,
        summary: "Best when you want immediate round-one damage: two active weapons, Stone touching a weapon, Banana fitted after.",
        tradeoffs: ["Less flexible utility space because damage pieces get first claim on the board."],
        cells: tempoCells,
        benchItems: tempoPlan.benchItems,
        gameState: input.gameState,
        layoutConfidence,
      }),
      buildOption({
        id: "stamina-safe",
        title: "Stamina Safe",
        score: 86,
        summary: "Best when you are worried about stamina/space: Banana is protected first, then damage pieces fit around it.",
        tradeoffs: ["Slightly safer stamina support, but less aggressive than the tempo weapon layout."],
        cells: staminaCells,
        benchItems: staminaPlan.benchItems,
        gameState: input.gameState,
        layoutConfidence,
      }),
    ],
  };
}
