"use client";

type ResumePanelProps = {
  name: string;
  onNameChange: (v: string) => void;
  resumeText: string;
  onResumeTextChange: (v: string) => void;
  onFileChange: (file: File | null) => void;
  busy: boolean;
  onAnalyze: (e: React.FormEvent) => void;
  useAi: boolean;
  onUseAiChange: (v: boolean) => void;
  geminiKey: string;
  onGeminiKeyChange: (v: string) => void;
  showGeminiKey: boolean;
  onToggleShowGeminiKey: () => void;
  onClearGeminiKey: () => void;
  serverAiReady: boolean;
  hasProfile: boolean;
};

export function ResumePanel({
  name,
  onNameChange,
  resumeText,
  onResumeTextChange,
  onFileChange,
  busy,
  onAnalyze,
  useAi,
  onUseAiChange,
  geminiKey,
  onGeminiKeyChange,
  showGeminiKey,
  onToggleShowGeminiKey,
  onClearGeminiKey,
  serverAiReady,
  hasProfile,
}: ResumePanelProps) {
  return (
    <section className="glass-panel p-4 sm:p-5">
      <h2 className="font-[family-name:var(--font-fraunces)] text-xl font-light text-sand">
        {hasProfile ? "Resume" : "Your resume"}
      </h2>
      <p className="mt-1.5 text-xs text-sand-muted">
        Optional — paste or upload PDF/TXT to sharpen fit. You can Hunt from
        titles alone; Analyze extracts skills and seniority locally (no Gemini
        required).
      </p>
      <form onSubmit={onAnalyze} className="mt-4 space-y-3">
        <label className="block text-sm">
          <span className="text-sand-muted">Display name</span>
          <input
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="Your name"
            className="focus-ring glass-input mt-1 w-full px-3 py-2 placeholder:text-sand-muted/50"
          />
        </label>
        <label className="block text-sm">
          <span className="text-sand-muted">Resume file (PDF or TXT)</span>
          <input
            type="file"
            accept=".pdf,.txt,.md,text/plain,application/pdf"
            onChange={(e) => onFileChange(e.target.files?.[0] || null)}
            className="focus-ring glass-file-input mt-1 block w-full text-sm text-sand-muted"
          />
        </label>
        <label className="block text-sm">
          <span className="text-sand-muted">Or paste resume text</span>
          <textarea
            value={resumeText}
            onChange={(e) => onResumeTextChange(e.target.value)}
            rows={hasProfile ? 5 : 8}
            placeholder="Paste your CV here…"
            className="focus-ring glass-input mt-1 w-full px-3 py-2 font-mono text-xs placeholder:text-sand-muted/50"
          />
        </label>

        <details className="glass-inset group">
          <summary className="cursor-pointer list-none px-3 py-2.5 text-sm font-medium text-sand marker:content-none [&::-webkit-details-marker]:hidden">
            <span className="flex items-center justify-between gap-2">
              Optional AI polish (BYOK)
              <span className="text-xs font-normal text-sand-muted group-open:hidden">
                Expand
              </span>
              <span className="hidden text-xs font-normal text-sand-muted group-open:inline">
                Collapse
              </span>
            </span>
          </summary>
          <div className="space-y-3 border-t border-[var(--line)] px-3 pb-3 pt-2">
            <p className="text-xs text-sand-muted">
              Gemini key stays in this browser (sessionStorage). Never used for
              scraping or scoring — profile notes and match drafts only.
              {serverAiReady
                ? " Server key available as fallback."
                : " Paste a key from Google AI Studio, or skip AI."}
            </p>
            <label className="block text-sm">
              <span className="text-sand-muted">Gemini API key</span>
              <div className="mt-1 flex gap-2">
                <input
                  type={showGeminiKey ? "text" : "password"}
                  value={geminiKey}
                  onChange={(e) => onGeminiKeyChange(e.target.value)}
                  placeholder="AIza…"
                  autoComplete="off"
                  spellCheck={false}
                  className="focus-ring glass-input min-w-0 flex-1 px-3 py-2 font-mono text-xs placeholder:text-sand-muted/50"
                />
                <button
                  type="button"
                  onClick={onToggleShowGeminiKey}
                  className="focus-ring glass-btn-ghost shrink-0 px-3 py-2 text-xs"
                >
                  {showGeminiKey ? "Hide" : "Show"}
                </button>
                {geminiKey ? (
                  <button
                    type="button"
                    onClick={onClearGeminiKey}
                    className="focus-ring glass-btn-ghost shrink-0 px-3 py-2 text-xs"
                  >
                    Clear
                  </button>
                ) : null}
              </div>
            </label>
            <p className="text-xs text-sand-muted">
              Free key:{" "}
              <a
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="text-seafoam underline"
              >
                Google AI Studio
              </a>
            </p>
            <label className="flex items-center gap-2 text-sm text-sand-muted">
              <input
                type="checkbox"
                checked={useAi}
                onChange={(e) => onUseAiChange(e.target.checked)}
              />
              Polish profile &amp; add match notes
            </label>
          </div>
        </details>

        <button
          type="submit"
          disabled={busy}
          className="focus-ring glass-btn-primary touch-target w-full px-5 py-3 text-sm disabled:opacity-60"
        >
          {busy
            ? "Analyzing…"
            : hasProfile
              ? "Re-analyze resume"
              : "Analyze resume"}
        </button>
      </form>
    </section>
  );
}
