import type { AnalysisResult } from "@/lib/core/types";

function formatValue(value: number | string | null): string {
  return value === null ? "Unknown" : String(value);
}

export function AnalysisStatePanel({ result }: { result: AnalysisResult | null }) {
  if (!result) {
    return null;
  }

  const { gameState, validation } = result;
  const shopItems = gameState.shopItems.map((item) => item.name).join(", ");
  const backpackItems = gameState.backpackItems.map((item) => item.name).join(", ");

  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Detected State</h2>
        <span className="pill">{validation.image.orientation}</span>
      </div>
      <dl className="state-grid">
        <div>
          <dt>Class</dt>
          <dd>{gameState.className}</dd>
        </div>
        <div>
          <dt>Round</dt>
          <dd>{formatValue(gameState.round)}</dd>
        </div>
        <div>
          <dt>Gold</dt>
          <dd>{formatValue(gameState.gold)}</dd>
        </div>
        <div>
          <dt>Lives</dt>
          <dd>{formatValue(gameState.lives)}</dd>
        </div>
      </dl>
      <div className="detected-lists">
        <p>
          <strong>Shop:</strong> {shopItems || "No shop items read"}
        </p>
        <p>
          <strong>Backpack:</strong> {backpackItems || "No backpack items read"}
        </p>
      </div>
      {validation.warnings.length ? (
        <ul className="warning-list">
          {validation.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
