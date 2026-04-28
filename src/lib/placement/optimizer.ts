import type { GameState, Recommendation } from "@/lib/core/types";
import { allBackpackItemsHaveCoordinates, coordinateLabel, currentPositionByName } from "./board";

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

const STAMINA_SAFE_CELLS: PlannedCell[] = [
  { item: "Wooden Sword", x: 1, y: 1, width: 1, height: 1, role: "primary weapon" },
  { item: "Broom", x: 2, y: 1, width: 1, height: 1, role: "second weapon" },
  { item: "Banana", x: 1, y: 2, width: 1, height: 1, role: "protected stamina support" },
  { item: "Stone", x: 2, y: 0, width: 1, height: 1, role: "weapon damage adjacency" },
  { item: "Lucky Clover", x: 0, y: 1, width: 1, height: 1, role: "luck support" },
  { item: "Shiny Shell", x: 0, y: 2, width: 1, height: 1, role: "cheap utility" },
  { item: "Walrus Tusk", x: 3, y: 1, width: 1, height: 1, role: "damage utility" },
];

function relevantNames(gameState: GameState, targetItems: string[]): Set<string> {
  return new Set([
    ...gameState.backpackItems.filter((item) => item.location === "bag").map((item) => item.name),
    ...targetItems,
  ]);
}

function cellsForRelevantItems(cells: PlannedCell[], names: Set<string>): PlannedCell[] {
  return cells.filter((cell) => names.has(cell.item));
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
  const tempoCells = cellsForRelevantItems(TEMPO_WEAPON_CELLS, names);
  const staminaCells = cellsForRelevantItems(STAMINA_SAFE_CELLS, names);

  if (tempoCells.length === 0 && staminaCells.length === 0) {
    return {
      layoutConfidence: "not-considered",
      placementAdvice: ["No grounded layout option was generated for the current visible items."],
      layoutOptions: [],
    };
  }

  const layoutConfidence: LayoutConfidence = allBackpackItemsHaveCoordinates(input.gameState)
    ? "considered"
    : "needs-confirmation";
  const placementAdvice =
    layoutConfidence === "considered"
      ? [
          "Current bag coordinates were considered when generating these options.",
          "Option 1 maximizes early weapon tempo by keeping Wooden Sword and Broom active with Stone adjacency.",
          "Option 2 protects Banana support first, then fits damage and utility pieces around the weapons.",
        ]
      : [
          "Layout confidence is low because current bag coordinates are missing; confirm current item positions before treating this as exact.",
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
