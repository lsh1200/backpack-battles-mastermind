import type { AnalysisResult } from "@/lib/core/types";

type CorrectionPanelProps = {
  result: AnalysisResult | null;
  corrections: Record<string, string>;
  setCorrections: (corrections: Record<string, string>) => void;
  onSubmit: () => void;
};

export function CorrectionPanel({ result, corrections, setCorrections, onSubmit }: CorrectionPanelProps) {
  if (!result?.correctionQuestions.length) {
    return null;
  }

  const answeredCount = result.correctionQuestions.filter((question) => corrections[question.field]).length;

  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Confirm Reads</h2>
        <span className="pill">
          {answeredCount}/{result.correctionQuestions.length}
        </span>
      </div>
      <div className="field-stack">
        {result.correctionQuestions.map((question) => (
          <label className="field" key={question.field}>
            <span>{question.question}</span>
            <select
              value={corrections[question.field] ?? ""}
              onChange={(event) => setCorrections({ ...corrections, [question.field]: event.target.value })}
            >
              <option value="">Choose</option>
              {question.options.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <button className="primary-button" disabled={answeredCount === 0} type="button" onClick={onSubmit}>
        Use corrections
      </button>
    </section>
  );
}
