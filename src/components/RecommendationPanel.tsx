import type { Recommendation } from "@/lib/core/types";

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
