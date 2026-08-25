const steps = [
  {
    title: "Drop in your resume",
    body: "Paste text or upload PDF/TXT. We extract titles, skills, and seniority in the browser — no Gemini required to hunt.",
  },
  {
    title: "Tune filters in one place",
    body: "Region, work mode, recency, seniority, excludes, and must-haves live beside your matches. Results come from public boards and APIs only.",
  },
  {
    title: "Hunt and work the shortlist",
    body: "Public sources + TypeScript filters. Match loop drips 10 at a time. You open links and apply yourself. Never auto-apply.",
  },
];

export function HowItWorks() {
  return (
    <section
      id="how"
      className="px-4 py-16 sm:px-6 sm:py-20 md:px-10"
    >
      <div className="mx-auto max-w-5xl">
        <h2 className="font-[family-name:var(--font-fraunces)] text-3xl font-light tracking-tight text-sand md:text-4xl">
          How it works
        </h2>
        <p className="mt-3 max-w-2xl text-lg text-sand-muted">
          One workspace from CV to shortlist — resume, filters, and matches
          together in your browser.
        </p>
        <ol className="mt-12 grid gap-6 md:grid-cols-3">
          {steps.map((step, index) => (
            <li key={step.title} className="glass-card relative p-6">
              <span className="font-[family-name:var(--font-fraunces)] text-4xl text-copper/80">
                {String(index + 1).padStart(2, "0")}
              </span>
              <h3 className="mt-3 text-xl font-medium text-sand">{step.title}</h3>
              <p className="mt-2 text-base leading-relaxed text-sand-muted">
                {step.body}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
