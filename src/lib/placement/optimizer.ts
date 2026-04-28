import type { GameState, Recommendation } from "@/lib/core/types";
import {
  allBackpackItemsHaveCoordinates,
  bagAwareBoard,
  classifyItemBagOccupancy,
  coordinateLabel,
  currentPositionByName,
  isBagItem,
  isCellInsideKnownBagSpace,
  type BagAwareBoard,
} from "./board";

export { bagAwareBoard, classifyItemBagOccupancy, type BagAwareBoard } from "./board";

type LayoutConfidence = Recommendation["layoutConfidence"];
type LayoutOption = Recommendation["layoutOptions"][number];

export type PlacementPlan = Pick<Recommendation, "layoutConfidence" | "placementAdvice" | "layoutOptions">;

type OptimizePlacementInput = {
  gameState: GameState;
  targetItems: string[];
};

type PlannedCell = LayoutOption["cells"][number];

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

function activeCellsByReadingOrder(board: BagAwareBoard): { x: number; y: number }[] {
  return [...board.activeBagCells].sort((left, right) => left.y - right.y || left.x - right.x);
}

function plannedCellFor(item: string, coordinate: { x: number; y: number }): PlannedCell {
  return {
    item,
    x: coordinate.x,
    y: coordinate.y,
    width: 1,
    height: 1,
    ...(ROLE_BY_ITEM.get(item) ? { role: ROLE_BY_ITEM.get(item) } : {}),
  };
}

function cellsForPriority(items: string[], names: Set<string>, board: BagAwareBoard, gameState: GameState): PlannedCell[] {
  const activeCells = activeCellsByReadingOrder(board);
  const freeCells = new Map(activeCells.map((cell) => [cellKey(cell), cell]));
  const cells: PlannedCell[] = [];

  for (const itemName of items) {
    if (!names.has(itemName) || freeCells.size === 0) {
      continue;
    }

    const current = gameState.backpackItems.find((item) => item.name === itemName);
    const currentCoordinate =
      current?.x !== undefined && current.y !== undefined ? { x: current.x, y: current.y } : undefined;
    const preferred = PREFERRED_CELL_BY_ITEM.get(itemName);
    const candidate =
      currentCoordinate &&
      isCellInsideKnownBagSpace(currentCoordinate, board) &&
      freeCells.has(cellKey(currentCoordinate))
        ? currentCoordinate
        : preferred && isCellInsideKnownBagSpace(preferred, board) && freeCells.has(cellKey(preferred))
          ? preferred
          : freeCells.values().next().value;

    if (!candidate) {
      continue;
    }

    cells.push(plannedCellFor(itemName, candidate));
    freeCells.delete(cellKey(candidate));
  }

  return cells;
}

function targetAction(cell: PlannedCell): string {
  if (cell.item === "Broom") {
    return `Place ${cell.item} at ${coordinateLabel(cell)} as your second active weapon.`;
  }

  if (cell.item === "Stone") {
    return `Place ${cell.item} at ${coordinateLabel(cell)} touching Wooden Sword or Broom.`;
  }

  if (cell.item === "Banana") {
    return `Place ${cell.item} at ${coordinateLabel(cell)} for stamina support without blocking weapons.`;
  }

  return `Place ${cell.item} at ${coordinateLabel(cell)}.`;
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

  const tempoPriority = ["Wooden Sword", "Broom", "Stone", "Banana", "Lucky Clover", "Shiny Shell", "Walrus Tusk"];
  const staminaPriority = ["Wooden Sword", "Banana", "Broom", "Stone", "Lucky Clover", "Shiny Shell", "Walrus Tusk"];
  const tempoCells = cellsForPriority(tempoPriority, names, board, input.gameState);
  const staminaCells = cellsForPriority(staminaPriority, names, board, input.gameState);

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
          "Known bag space was considered when generating these options.",
          ...(tempoCells.length < names.size
            ? [`Known active bag space fits ${tempoCells.length} of ${names.size} relevant items; keep lower-priority pieces in storage until more bags are placed.`]
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
        gameState: input.gameState,
        layoutConfidence,
      }),
    ],
  };
}
