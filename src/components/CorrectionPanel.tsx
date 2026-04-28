import type { AnalysisResult } from "@/lib/core/types";

/* eslint-disable @next/next/no-img-element -- Crop URLs are generated local handoff assets, not static optimized images. */

type CorrectionPanelProps = {
  result: AnalysisResult | null;
  corrections: Record<string, string>;
  setCorrections: (corrections: Record<string, string>) => void;
  onSubmit: () => void;
};

function correctValue(question: AnalysisResult["correctionQuestions"][number]): string {
  return question.currentValue ?? "Correct";
}

export function CorrectionPanel({ result, corrections, setCorrections, onSubmit }: CorrectionPanelProps) {
  if (!result?.correctionQuestions.length) {
    return null;
  }

  const answeredCount = result.correctionQuestions.filter((question) => corrections[question.field]).length;
  const updateCorrection = (field: string, value: string) => setCorrections({ ...corrections, [field]: value });

  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Confirm Reads</h2>
        <span className="pill">
          {answeredCount}/{result.correctionQuestions.length}
        </span>
      </div>
      <div className="field-stack">
        {result.correctionQuestions.map((question) => {
          const options = question.currentValue && !question.options.includes(question.currentValue)
            ? [question.currentValue, ...question.options]
            : question.options;

          return (
            <article className="correction-card" key={question.field}>
              {question.imageUrl ? (
                <img
                  alt={`Cropped screenshot for ${question.context ?? question.field}`}
                  className="correction-crop"
                  src={question.imageUrl}
                />
              ) : null}
              <div className="correction-content">
                <p className="correction-question">{question.question}</p>
                {question.context ? <p className="correction-context">{question.context}</p> : null}
                {question.currentValue ? (
                  <p className="correction-current">
                    Current read: <strong>{question.currentValue}</strong>
                  </p>
                ) : null}
                <div className="correction-actions">
                  <button type="button" className="secondary-button" onClick={() => updateCorrection(question.field, correctValue(question))}>
                    Correct
                  </button>
                  <label className="correction-select">
                    <span>Actually this is</span>
                    <select
                      value={corrections[question.field] ?? ""}
                      onChange={(event) => updateCorrection(question.field, event.target.value)}
                    >
                      <option value="">Choose</option>
                      {options.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
            </article>
          );
        })}
      </div>
      <button className="primary-button" disabled={answeredCount === 0} type="button" onClick={onSubmit}>
        Use corrections
      </button>
    </section>
  );
}
