"use client";

/* eslint-disable @next/next/no-img-element -- User-selected blob URLs are local previews, not optimized app assets. */

type ScreenshotIntakeProps = {
  previewUrl: string | null;
  busy: boolean;
  onFile: (file: File) => void;
  onAnalyze: () => void;
};

export function ScreenshotIntake({ previewUrl, busy, onFile, onAnalyze }: ScreenshotIntakeProps) {
  return (
    <section className="panel intake-panel" aria-label="Screenshot upload">
      <label className="file-drop">
        <input
          accept="image/png,image/jpeg,image/webp"
          type="file"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) {
              onFile(file);
            }
          }}
        />
        <span>{previewUrl ? "Change screenshot" : "Choose screenshot"}</span>
      </label>
      {previewUrl ? (
        <img alt="Uploaded Backpack Battles screenshot" className="screenshot-preview" src={previewUrl} />
      ) : null}
      <button className="primary-button" disabled={!previewUrl || busy} type="button" onClick={onAnalyze}>
        {busy ? "Analyzing..." : "Analyze round"}
      </button>
    </section>
  );
}
