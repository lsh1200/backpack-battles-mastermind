import type { AnalysisResult } from "@/lib/core/types";

export function HistoryPanel({ history }: { history: AnalysisResult[] }) {
  if (!history.length) {
    return null;
  }

  return (
    <section className="panel">
      <h2>Recent Fixtures</h2>
      <ul className="history-list">
        {history.map((entry, index) => (
          <li key={`${entry.gameState.className}-${entry.gameState.round ?? "unknown"}-${index}`}>
            <span>
              {entry.gameState.className} round {entry.gameState.round ?? "?"}
            </span>
            <strong>{entry.recommendation?.bestAction.target ?? "awaiting correction"}</strong>
          </li>
        ))}
      </ul>
    </section>
  );
}
