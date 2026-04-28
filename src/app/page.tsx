"use client";

import { useEffect, useRef, useState } from "react";
import { AnalysisStatePanel } from "@/components/AnalysisStatePanel";
import { CorrectionPanel } from "@/components/CorrectionPanel";
import { HandoffPanel, type CodexHandoffState } from "@/components/HandoffPanel";
import { HandoffResumePanel } from "@/components/HandoffResumePanel";
import { HistoryPanel } from "@/components/HistoryPanel";
import { RecommendationPanel } from "@/components/RecommendationPanel";
import { ScreenshotIntake } from "@/components/ScreenshotIntake";
import { codexHandoffScreenshotUrl, codexHandoffStatusUrl } from "@/lib/codex-handoff/client";
import type { AnalysisResult, ValidationReport } from "@/lib/core/types";
import { applyCorrections, applyValidationCorrections } from "@/lib/vision/correction";

type AnalysisMode = "api" | "codex";

export default function HomePage() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [history, setHistory] = useState<AnalysisResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [corrections, setCorrections] = useState<Record<string, string>>({});
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [mode, setMode] = useState<AnalysisMode>("api");
  const [handoff, setHandoff] = useState<CodexHandoffState | null>(null);
  const [handoffIdInput, setHandoffIdInput] = useState("");
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

  async function analyzeWithApi(correctedState?: unknown, correctedValidation?: ValidationReport) {
    if (!file && !correctedState) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const form = new FormData();
      if (file) {
        form.append("screenshot", file);
      }
      if (correctedState) {
        const validationForRequest = correctedValidation ?? (!file ? result?.validation : undefined);
        form.append("correctedState", JSON.stringify(correctedState));
        if (validationForRequest) {
          form.append("validation", JSON.stringify(validationForRequest));
        }
      }

      const response = await fetch("/api/analyze", { method: "POST", body: form });
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error ?? "Analysis failed");
      }

      setResult(json);
      setHandoff(null);
      setCorrections({});
      await refreshHistory();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Analysis failed");
    } finally {
      setBusy(false);
    }
  }

  async function createCodexHandoff() {
    if (!file) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const form = new FormData();
      form.append("screenshot", file);
      const response = await fetch("/api/codex-handoff", { method: "POST", body: form });
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error ?? "Codex handoff failed");
      }

      setResult(null);
      setCorrections({});
      setHandoff({
        handoffId: json.handoffId,
        status: json.status,
        prompt: json.prompt,
        promptPath: json.promptPath,
        resultPath: json.resultPath,
        screenshotPath: json.screenshotPath,
        validation: json.validation,
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Codex handoff failed");
    } finally {
      setBusy(false);
    }
  }

  function analyze(correctedState?: unknown, correctedValidation?: ValidationReport) {
    if (correctedState || mode === "api") {
      void analyzeWithApi(correctedState, correctedValidation);
      return;
    }

    void createCodexHandoff();
  }

  async function resumeCodexHandoff() {
    const handoffId = handoffIdInput.trim();
    if (!handoffId) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const response = await fetch(codexHandoffStatusUrl(handoffId));
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error ?? "Codex handoff resume failed");
      }

      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }

      setFile(null);
      setPreviewUrl(codexHandoffScreenshotUrl(handoffId));
      setHandoff({
        handoffId: json.handoffId,
        status: json.status,
        prompt: json.prompt,
        promptPath: json.promptPath,
        resultPath: json.resultPath,
        screenshotPath: json.screenshotPath,
        validation: json.validation,
      });
      setCorrections({});

      if (json.status === "complete") {
        setResult(json.result);
      } else {
        setResult(null);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Codex handoff resume failed");
    } finally {
      setBusy(false);
    }
  }

  function submitCorrections() {
    if (!result) {
      return;
    }

    analyze(applyCorrections(result.gameState, corrections), applyValidationCorrections(result.validation, corrections));
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

  useEffect(() => {
    if (!handoff || handoff.status !== "pending") {
      return;
    }

    const handoffId = handoff.handoffId;
    const controller = new AbortController();
    let active = true;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    async function pollHandoff() {
      try {
        const response = await fetch(codexHandoffStatusUrl(handoffId), { signal: controller.signal });
        const json = await response.json();
        if (!response.ok) {
          throw new Error(json.error ?? "Codex handoff polling failed");
        }

        if (!active) {
          return;
        }

        if (json.status === "complete") {
          setResult(json.result);
          setCorrections({});
          setHandoff((current) => (current ? { ...current, status: "complete" } : current));
          return;
        }

        timeoutId = setTimeout(pollHandoff, 3000);
      } catch (caught) {
        if (!active || (caught instanceof DOMException && caught.name === "AbortError")) {
          return;
        }

        setError(caught instanceof Error ? caught.message : "Codex handoff polling failed");
      }
    }

    timeoutId = setTimeout(pollHandoff, 1000);

    return () => {
      active = false;
      controller.abort();
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [handoff]);

  function handleFile(nextFile: File) {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
    }

    const nextPreviewUrl = URL.createObjectURL(nextFile);
    previewUrlRef.current = nextPreviewUrl;
    setPreviewUrl(nextPreviewUrl);
    setFile(nextFile);
    setResult(null);
    setHandoff(null);
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
        mode={mode}
        previewUrl={previewUrl}
        validation={result?.validation ?? handoff?.validation ?? null}
        onAnalyze={() => analyze()}
        onFile={handleFile}
        onModeChange={setMode}
      />
      {mode === "codex" ? (
        <HandoffResumePanel
          busy={busy}
          handoffId={handoffIdInput}
          onHandoffIdChange={setHandoffIdInput}
          onResume={() => void resumeCodexHandoff()}
        />
      ) : null}
      {error ? <section className="panel error-panel">{error}</section> : null}
      <HandoffPanel handoff={handoff} />
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
