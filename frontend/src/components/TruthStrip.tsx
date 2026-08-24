import Link from "next/link";

export function TruthStrip() {
  return (
    <section className="border-t border-[var(--line)] px-6 py-16 md:px-10">
      <div className="mx-auto flex max-w-5xl flex-col gap-8 md:flex-row md:items-end md:justify-between">
        <div className="max-w-xl">
          <h2 className="font-[family-name:var(--font-fraunces)] text-3xl font-light tracking-tight text-sand">
            What it does — and does not
          </h2>
          <ul className="mt-6 space-y-3 text-sm text-sand-muted">
            <li>✓ Matches roles to your CV with skill synonyms and seniority guardrails</li>
            <li>✓ Keeps only fresh ads (last 7 days + 8–14 days)</li>
            <li>✓ Works in the browser on Vercel; Python CLI remains for power users</li>
            <li>✗ Does not auto-apply or message employers for you</li>
            <li>✗ Does not scrape with Gemini — hunt stays cheap and local to the filter</li>
          </ul>
        </div>
        <Link
          href="https://github.com/alfredalpino/JobHunter"
          target="_blank"
          rel="noreferrer"
          className="focus-ring inline-flex rounded-full border border-copper/50 px-6 py-3 text-sm font-medium text-copper transition-colors hover:bg-copper/10"
        >
          View on GitHub
        </Link>
      </div>
    </section>
  );
}
