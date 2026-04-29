type HandoffResumePanelProps = {
  busy: boolean;
  handoffId: string;
  onHandoffIdChange: (handoffId: string) => void;
  onResume: () => void;
};

export function HandoffResumePanel({ busy, handoffId, onHandoffIdChange, onResume }: HandoffResumePanelProps) {
  return (
    <section className="panel resume-panel">
      <label className="field">
        <span>Resume handoff</span>
        <input
          value={handoffId}
          placeholder="Paste handoff ID"
          onChange={(event) => onHandoffIdChange(event.target.value)}
        />
      </label>
      <button className="primary-button" disabled={busy || handoffId.trim().length === 0} type="button" onClick={onResume}>
        Resume
      </button>
    </section>
  );
}
