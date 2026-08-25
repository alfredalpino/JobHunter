import Link from "next/link";

const tiers = [
  {
    name: "JobHunter",
    price: "$0",
    period: "forever",
    note: "Run the web app, hunt fresh roles, filter by your resume. No card required.",
  },
  {
    name: "Self-host / CLI",
    price: "$0",
    period: "still",
    note: "Clone the repo, use the Python CLI, tweak region packs. It's yours.",
  },
  {
    name: "Optional AI polish",
    price: "Your key",
    period: "if you want",
    note: "Bring your own Gemini key for profile or match notes. We don't sell tokens.",
  },
];

export function Pricing() {
  return (
    <section
      id="pricing"
      className="border-t border-[var(--glass-border)] px-4 py-16 sm:px-6 sm:py-20 md:px-10"
    >
      <div className="mx-auto max-w-5xl">
        <p className="text-sm font-medium text-seafoam">Pricing</p>
        <h2 className="mt-3 font-[family-name:var(--font-fraunces)] text-3xl font-light tracking-tight text-sand md:text-4xl">
          Hunting for work shouldn&apos;t cost a second rent
        </h2>

        <div className="mt-8 max-w-3xl space-y-4 text-base leading-relaxed text-sand-muted md:text-lg">
          <p>
            A lot of job tools want <strong className="font-medium text-sand">$15–25 a month</strong>{" "}
            to show you listings that are already on the public internet — often while
            you&apos;re the one between paychecks. I find that a bit rich. Access to a
            decent shortlist isn&apos;t a luxury add-on; it&apos;s the whole point of looking.
          </p>
          <p>
            JobHunter is{" "}
            <strong className="font-medium text-sand">open source</strong>. Use it in the
            browser, fork it, self-host it, share it with a friend who&apos;s hunting in
            Dubai, the US, or anywhere the region packs cover. No paywall on “see jobs
            that fit you.” No auto-apply upsell. You stay in control of every application.
          </p>
          <p>
            If a hosted SaaS wants your card before your first serious lead, ask what
            you&apos;re really paying for. Here, the filter is deterministic, the hunt uses
            public APIs, and AI is optional polish — not a toll booth.
          </p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {tiers.map((tier) => (
            <div key={tier.name} className="glass-card p-5">
              <p className="font-[family-name:var(--font-fraunces)] text-xl text-copper">
                {tier.price}
              </p>
              <p className="text-xs uppercase tracking-[0.14em] text-sand-muted">
                {tier.period}
              </p>
              <h3 className="mt-3 text-lg font-medium text-sand">{tier.name}</h3>
              <p className="mt-2 text-sm leading-relaxed text-sand-muted">{tier.note}</p>
            </div>
          ))}
        </div>

        <div className="glass-panel mt-10 flex flex-col gap-6 p-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-xl">
            <p className="font-[family-name:var(--font-fraunces)] text-lg text-sand">
              — Alfred Alpino
            </p>
            <p className="mt-2 text-sm leading-relaxed text-sand-muted">
              Built this because I needed it, not because I wanted another subscription
              line on someone&apos;s dashboard. Good hunts shouldn&apos;t require a monthly
              ritual of cancelling before the trial ends.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:items-end">
            <Link
              href="/app"
              className="focus-ring glass-btn-primary touch-target inline-flex w-full items-center justify-center px-6 py-3 text-sm sm:w-auto"
            >
              Start hunting — free
            </Link>
            <Link
              href="https://github.com/alfredalpino/JobHunter"
              target="_blank"
              rel="noreferrer"
              className="focus-ring text-sm text-copper hover:underline"
            >
              View source on GitHub
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
