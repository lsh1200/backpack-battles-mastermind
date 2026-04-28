"use client";

/* eslint-disable @next/next/no-img-element -- User-selected blob URLs are local previews, not optimized app assets. */

import { useRef } from "react";

type ScreenshotIntakeProps = {
  previewUrl: string | null;
  busy: boolean;
  mode: "api" | "codex";
  onFile: (file: File) => void;
  onModeChange: (mode: "api" | "codex") => void;
  onAnalyze: () => void;
};

export function ScreenshotIntake({
  previewUrl,
  busy,
  mode,
  onFile,
  onModeChange,
  onAnalyze,
}: ScreenshotIntakeProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <section className="panel intake-panel" aria-label="Screenshot upload">
      <div className="mode-toggle" role="group" aria-label="Analysis mode">
        <button
          className={mode === "api" ? "mode-button active" : "mode-button"}
          type="button"
          onClick={() => onModeChange("api")}
        >
          API
        </button>
        <button
          className={mode === "codex" ? "mode-button active" : "mode-button"}
          type="button"
          onClick={() => onModeChange("codex")}
        >
          Codex test
        </button>
      </div>
      <div className="file-drop">
        <input
          accept="image/png,image/jpeg,image/webp"
          ref={inputRef}
          type="file"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) {
              onFile(file);
              event.target.value = "";
            }
          }}
        />
        <button className="file-button" disabled={busy} type="button" onClick={() => inputRef.current?.click()}>
          {previewUrl ? "Change screenshot" : "Choose screenshot"}
        </button>
      </div>
      {previewUrl ? (
        <img alt="Uploaded Backpack Battles screenshot" className="screenshot-preview" src={previewUrl} />
      ) : null}
      <button className="primary-button" disabled={!previewUrl || busy} type="button" onClick={onAnalyze}>
        {busy ? "Working..." : mode === "api" ? "Analyze round" : "Create Codex handoff"}
      </button>
    </section>
  );
}
