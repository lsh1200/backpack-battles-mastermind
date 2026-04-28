import type { CSSProperties } from "react";
import type { Recommendation } from "@/lib/core/types";

function layoutConfidenceLabel(confidence: Recommendation["layoutConfidence"]): string {
  return confidence
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function LayoutOptionCard({ option }: { option: Recommendation["layoutOptions"][number] }) {
  const columns = Math.max(4, ...option.cells.map((cell) => cell.x + cell.width));
  const rows = Math.max(3, ...option.cells.map((cell) => cell.y + cell.height));
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
      <div className="layout-grid" style={gridStyle}>
        {option.cells.map((cell) => (
          <div
            className="layout-cell"
            key={`${option.id}-${cell.item}`}
            style={{
              gridColumn: `${cell.x + 1} / span ${cell.width}`,
              gridRow: `${cell.y + 1} / span ${cell.height}`,
            }}
          >
            <strong>{cell.item}</strong>
            {cell.role ? <span>{cell.role}</span> : null}
          </div>
        ))}
      </div>
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
