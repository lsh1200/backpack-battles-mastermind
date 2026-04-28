/* eslint-disable @next/next/no-img-element */
import type { CSSProperties } from "react";
import type { Recommendation } from "@/lib/core/types";

function layoutConfidenceLabel(confidence: Recommendation["layoutConfidence"]): string {
  return confidence
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function shapeDimensions(shape: number[][] | undefined): { columns: number; rows: number } {
  return {
    columns: Math.max(1, ...(shape ?? [[1]]).map((row) => row.length)),
    rows: Math.max(1, shape?.length ?? 1),
  };
}

function shapeClipPath(shape: number[][] | undefined): string | undefined {
  const cellSize = 66;
  const resolvedShape = shape ?? [[1]];
  const paths = resolvedShape.flatMap((row, y) =>
    row.flatMap((value, x) =>
      value === 1 ? [`M${x * cellSize},${y * cellSize} h${cellSize} v${cellSize} h-${cellSize} Z`] : [],
    ),
  );

  return paths.length ? `path('${paths.join(" ")}')` : undefined;
}

function occupiedShapeCells(shape: number[][] | undefined): { x: number; y: number }[] {
  return (shape ?? [[1]]).flatMap((row, y) => row.flatMap((value, x) => (value === 1 ? [{ x, y }] : [])));
}

function shapeMarkers(shape: number[][] | undefined): { x: number; y: number; value: number }[] {
  return (shape ?? [[1]]).flatMap((row, y) =>
    row.flatMap((value, x) => (value > 1 ? [{ x, y, value }] : [])),
  );
}

function ItemShape({ label, shape, imageUrl }: { label: string; shape?: number[][]; imageUrl?: string }) {
  const dimensions = shapeDimensions(shape);
  const resolvedShape = shape ?? [[1]];
  const style = {
    "--shape-columns": dimensions.columns,
    "--shape-rows": dimensions.rows,
  } as CSSProperties;

  return (
    <div className="item-shape" style={style} aria-label={`${label} footprint`}>
      {imageUrl ? <img alt="" className="shape-thumb" src={imageUrl} /> : null}
      {Array.from({ length: dimensions.rows }).flatMap((_, y) =>
        Array.from({ length: dimensions.columns }).map((__, x) => {
          const value = resolvedShape[y]?.[x] ?? 0;
          return (
            <span
              aria-hidden="true"
              className={`shape-cell ${value === 1 ? "filled" : value > 1 ? "marker" : "empty"}`}
              key={`${label}-${x}-${y}`}
            />
          );
        }),
      )}
    </div>
  );
}

function InventoryItem({
  cell,
  optionId,
  minX,
  minY,
}: {
  cell: Recommendation["layoutOptions"][number]["cells"][number];
  optionId: string;
  minX: number;
  minY: number;
}) {
  const clipPath = shapeClipPath(cell.shape);
  const occupiedCells = occupiedShapeCells(cell.shape);
  const markers = shapeMarkers(cell.shape);
  const style = {
    gridColumn: `${cell.x - minX + 1} / span ${cell.width}`,
    gridRow: `${cell.y - minY + 1} / span ${cell.height}`,
    "--item-width": cell.width,
    "--item-height": cell.height,
    "--item-rotation": `${cell.rotation ?? 0}deg`,
  } as CSSProperties;
  const hitboxStyle = {
    ...(clipPath ? { clipPath } : {}),
  } as CSSProperties;

  return (
    <details className="inventory-item" key={`${optionId}-${cell.item}`} style={style}>
      <summary aria-label={`${cell.item} layout details`}>
        {occupiedCells.map((occupiedCell) => (
          <span
            aria-hidden="true"
            className="item-body-cell"
            key={`${cell.item}-body-${occupiedCell.x}-${occupiedCell.y}`}
            style={{
              gridColumn: occupiedCell.x + 1,
              gridRow: occupiedCell.y + 1,
            }}
          />
        ))}
        <span className="inventory-item-art">
          {cell.imageUrl ? (
            <img alt={cell.item} src={cell.imageUrl} />
          ) : (
            <span className="inventory-item-fallback">{cell.item.slice(0, 2)}</span>
          )}
        </span>
        {markers.map((marker) => (
          <span
            aria-hidden="true"
            className={`item-marker marker-${marker.value}`}
            key={`${cell.item}-${marker.x}-${marker.y}-${marker.value}`}
            style={{
              left: `calc(${marker.x} * var(--inventory-cell) + var(--inventory-cell) / 2)`,
              top: `calc(${marker.y} * var(--inventory-cell) + var(--inventory-cell) / 2)`,
            }}
          />
        ))}
        <span aria-hidden="true" className="inventory-item-hitbox" style={hitboxStyle} />
      </summary>
      <div className="inventory-popover">
        <strong>{cell.item}</strong>
        {cell.role ? <span>{cell.role}</span> : null}
        {cell.rotation ? <span>Rotate {cell.rotation} deg</span> : null}
        <span>
          {cell.width}x{cell.height} occupied footprint
        </span>
      </div>
    </details>
  );
}

function LayoutOptionCard({ option }: { option: Recommendation["layoutOptions"][number] }) {
  const optionBoardCells = option.boardCells ?? [];
  const boardCells = optionBoardCells.length
    ? optionBoardCells
    : option.cells.flatMap((cell) =>
        Array.from({ length: cell.height }).flatMap((_, y) =>
          Array.from({ length: cell.width }).map((__, x) => ({ x: cell.x + x, y: cell.y + y })),
        ),
      );
  const minX = Math.min(0, ...boardCells.map((cell) => cell.x), ...option.cells.map((cell) => cell.x));
  const minY = Math.min(0, ...boardCells.map((cell) => cell.y), ...option.cells.map((cell) => cell.y));
  const maxX = Math.max(1, ...boardCells.map((cell) => cell.x + 1), ...option.cells.map((cell) => cell.x + cell.width));
  const maxY = Math.max(2, ...boardCells.map((cell) => cell.y + 1), ...option.cells.map((cell) => cell.y + cell.height));
  const columns = Math.max(2, maxX - minX);
  const rows = Math.max(3, maxY - minY);
  const activeBoardCellKeys = new Set(boardCells.map((cell) => `${cell.x},${cell.y}`));
  const displayCells = Array.from({ length: rows }).flatMap((_, y) =>
    Array.from({ length: columns }).map((__, x) => ({ x: minX + x, y: minY + y })),
  );
  const gridStyle = {
    "--layout-columns": columns,
    "--layout-rows": rows,
  } as CSSProperties;

  return (
    <article className="layout-option">
      <div className="layout-option-header">
        <div>
          <h4>{option.title}</h4>
          <p>{option.summary}</p>
        </div>
        <span>{option.score}</span>
      </div>
      <div className="inventory-board" style={gridStyle}>
        {displayCells.map((cell) => (
          <span
            aria-hidden="true"
            className={`inventory-board-cell ${activeBoardCellKeys.has(`${cell.x},${cell.y}`) ? "has-bag" : "no-bag"}`}
            key={`${option.id}-board-${cell.x}-${cell.y}`}
            style={{ gridColumn: cell.x - minX + 1, gridRow: cell.y - minY + 1 }}
          />
        ))}
        {option.cells.map((cell) => (
          <InventoryItem cell={cell} key={`${option.id}-${cell.item}`} minX={minX} minY={minY} optionId={option.id} />
        ))}
      </div>
      {option.benchItems.length ? (
        <div className="bench-items">
          <h5>Storage for now</h5>
          <div className="bench-list">
            {option.benchItems.map((item) => (
              <div className="bench-item" key={`${option.id}-${item.item}`}>
                <ItemShape imageUrl={item.imageUrl} label={item.item} shape={item.shape} />
                <div>
                  <strong>{item.item}</strong>
                  <span>{item.reason}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      <div className="layout-details">
        <h5>Moves</h5>
        <ul>
          {option.moves.map((move) => (
            <li key={move}>{move}</li>
          ))}
        </ul>
        <h5>Tradeoff</h5>
        <ul>
          {option.tradeoffs.map((tradeoff) => (
            <li key={tradeoff}>{tradeoff}</li>
          ))}
        </ul>
      </div>
    </article>
  );
}

export function RecommendationPanel({ recommendation }: { recommendation: Recommendation | null }) {
  if (!recommendation) {
    return null;
  }

  return (
    <section className="panel recommendation">
      <p className="eyebrow">Best Step</p>
      <h2>
        {recommendation.bestAction.type}: {recommendation.bestAction.target}
      </h2>
      <p className="lead-text">{recommendation.shortReason}</p>
      <div className="coach-section">
        <h3>Why</h3>
        <p>{recommendation.bestAction.teachingReason}</p>
      </div>
      <div className="coach-section">
        <h3>Plan</h3>
        <p>{recommendation.planSupported}</p>
      </div>
      <div className="coach-section">
        <h3>Layout Confidence</h3>
        <p>
          <strong>{layoutConfidenceLabel(recommendation.layoutConfidence)}</strong>
        </p>
      </div>
      <div className="coach-section">
        <h3>Item Recognition</h3>
        <p>
          <strong>{recommendation.recognitionPolicy.itemRecognition}</strong>: {recommendation.recognitionPolicy.summary}
        </p>
        {recommendation.recognitionPolicy.warnings.length ? (
          <ul>
            {recommendation.recognitionPolicy.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        ) : null}
      </div>
      {recommendation.placementAdvice.length ? (
        <div className="coach-section">
          <h3>Placement</h3>
          <ul>
            {recommendation.placementAdvice.map((placement) => (
              <li key={placement}>{placement}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {recommendation.layoutOptions.length ? (
        <div className="coach-section">
          <h3>Layout Options</h3>
          <div className="layout-options">
            {recommendation.layoutOptions.map((option) => (
              <LayoutOptionCard key={option.id} option={option} />
            ))}
          </div>
        </div>
      ) : null}
      <div className="coach-section">
        <h3>Next Targets</h3>
        <ul>
          {recommendation.nextTargets.map((target) => (
            <li key={target}>{target}</li>
          ))}
        </ul>
      </div>
      {recommendation.assumptionsMade.length ? (
        <div className="coach-section">
          <h3>Assumptions</h3>
          <ul>
            {recommendation.assumptionsMade.map((assumption) => (
              <li key={assumption}>{assumption}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
