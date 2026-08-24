const steps = [
  {
    title: "Analyze your resume",
    body: "Local profile from your CV — skills, titles, seniority. AI polish is optional and off by default.",
  },
  {
    title: "Choose a region",
    body: "Dubai, USA, India, Bangalore, Lucknow, Alberta, Washington, Warsaw, remote, or worldwide packs.",
  },
  {
    title: "Hunt fresh matches",
    body: "Scrapers and JobSpy find listings. We keep ≤14-day posts that fit you. You apply yourself.",
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="border-t border-[var(--line)] px-6 py-20 md:px-10">
      <div className="mx-auto max-w-5xl">
        <h2 className="font-[family-name:var(--font-fraunces)] text-3xl font-light tracking-tight text-sand md:text-4xl">
          How it works
        </h2>
        <p className="mt-3 max-w-2xl text-sand-muted">
          One clear path from CV to a shortlist. Hunting never burns AI credits.
        </p>
        <ol className="mt-12 grid gap-10 md:grid-cols-3">
          {steps.map((step, index) => (
            <li key={step.title} className="relative">
              <span className="font-[family-name:var(--font-fraunces)] text-4xl text-copper/80">
                {String(index + 1).padStart(2, "0")}
              </span>
              <h3 className="mt-3 text-lg font-medium text-sand">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-sand-muted">
                {step.body}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
