type CodexHandoffState = {
  handoffId: string;
  status: "pending" | "complete";
  prompt: string;
  promptPath: string;
  resultPath: string;
  screenshotPath: string;
};

export function HandoffPanel({ handoff }: { handoff: CodexHandoffState | null }) {
  if (!handoff) {
    return null;
  }

  return (
    <section className="panel handoff-panel">
      <div className="panel-header">
        <h2>Codex Handoff</h2>
        <span className="pill">{handoff.status}</span>
      </div>
      <dl className="handoff-paths">
        <div>
          <dt>ID</dt>
          <dd>{handoff.handoffId}</dd>
        </div>
        <div>
          <dt>Prompt</dt>
          <dd>{handoff.promptPath}</dd>
        </div>
        <div>
          <dt>Result</dt>
          <dd>{handoff.resultPath}</dd>
        </div>
        <div>
          <dt>Screenshot</dt>
          <dd>{handoff.screenshotPath}</dd>
        </div>
      </dl>
      <textarea className="prompt-preview" readOnly value={handoff.prompt} aria-label="Codex handoff prompt" />
    </section>
  );
}

export type { CodexHandoffState };
