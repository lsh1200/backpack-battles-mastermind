"use client";

import { useEffect, useRef, useState } from "react";
import { AnalysisStatePanel } from "@/components/AnalysisStatePanel";
import { CorrectionPanel } from "@/components/CorrectionPanel";
import { HistoryPanel } from "@/components/HistoryPanel";
import { RecommendationPanel } from "@/components/RecommendationPanel";
import { ScreenshotIntake } from "@/components/ScreenshotIntake";
import type { AnalysisResult } from "@/lib/core/types";
import { applyCorrections } from "@/lib/vision/correction";

export default function HomePage() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [history, setHistory] = useState<AnalysisResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [corrections, setCorrections] = useState<Record<string, string>>({});
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    };
  }, []);

  async function refreshHistory() {
    try {
      const response = await fetch("/api/fixtures");
      const json = await response.json();
      setHistory(json.data ?? []);
    } catch {
      setHistory([]);
    }
  }

  async function analyze(correctedState?: unknown) {
    if (!file) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const form = new FormData();
      form.append("screenshot", file);
      if (correctedState) {
        form.append("correctedState", JSON.stringify(correctedState));
      }

      const response = await fetch("/api/analyze", { method: "POST", body: form });
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error ?? "Analysis failed");
      }

      setResult(json);
      setCorrections({});
      await refreshHistory();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Analysis failed");
    } finally {
      setBusy(false);
    }
  }

  function submitCorrections() {
    if (!result) {
      return;
    }

    void analyze(applyCorrections(result.gameState, corrections));
  }

  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/fixtures", { signal: controller.signal })
      .then((response) => response.json())
      .then((json) => setHistory(json.data ?? []))
      .catch((caught: unknown) => {
        if (!(caught instanceof DOMException && caught.name === "AbortError")) {
          setHistory([]);
        }
      });

    return () => controller.abort();
  }, []);

  function handleFile(nextFile: File) {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
    }

    const nextPreviewUrl = URL.createObjectURL(nextFile);
    previewUrlRef.current = nextPreviewUrl;
    setPreviewUrl(nextPreviewUrl);
    setFile(nextFile);
    setResult(null);
    setError(null);
    setCorrections({});
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <p className="eyebrow">Backpack Battles Mastermind</p>
        <h1>Round coach</h1>
      </header>
      <ScreenshotIntake
        busy={busy}
        previewUrl={previewUrl}
        onAnalyze={() => void analyze()}
        onFile={handleFile}
      />
      {error ? <section className="panel error-panel">{error}</section> : null}
      <AnalysisStatePanel result={result} />
      <CorrectionPanel
        corrections={corrections}
        result={result}
        setCorrections={setCorrections}
        onSubmit={submitCorrections}
      />
      <RecommendationPanel recommendation={result?.recommendation ?? null} />
      <HistoryPanel history={history} />
    </main>
  );
}
