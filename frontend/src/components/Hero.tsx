import Link from "next/link";

export function Hero() {
  return (
    <section className="relative flex min-h-[calc(100svh-5.5rem)] flex-col justify-center px-6 pb-24 pt-10 md:px-10">
      <div className="horizon" aria-hidden />
      <div className="relative z-10 mx-auto w-full max-w-4xl">
        <p className="rise text-[11px] font-medium uppercase tracking-[0.22em] text-seafoam">
          JobHunter · Alfredterminal
        </p>
        <h1 className="rise rise-delay-1 mt-5 max-w-[14ch] font-[family-name:var(--font-fraunces)] text-[clamp(2.6rem,7vw,4.6rem)] font-light leading-[1.05] tracking-tight text-sand">
          Fresh jobs. Your resume. Your move.
        </h1>
        <p className="rise rise-delay-2 mt-6 max-w-xl text-lg leading-relaxed text-sand-muted">
          Upload a CV, pick a region, and keep only roles that match you — posted
          in the last two weeks. No auto-apply. Ever.
        </p>
        <div className="rise rise-delay-3 mt-10 flex flex-wrap gap-3">
          <Link
            href="/app"
            className="focus-ring inline-flex items-center justify-center rounded-full bg-copper px-6 py-3 text-sm font-semibold text-ink transition-transform hover:-translate-y-0.5"
          >
            Get started
          </Link>
          <Link
            href="/app#analyze"
            className="focus-ring inline-flex items-center justify-center rounded-full border border-seafoam/35 bg-ink-mid/40 px-6 py-3 text-sm font-medium text-sand backdrop-blur-sm transition-colors hover:border-seafoam/70"
          >
            Analyze resume
          </Link>
          <Link
            href="/#preferences"
            className="focus-ring inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-medium text-sand-muted transition-colors hover:text-sand"
          >
            Prefer region
          </Link>
        </div>
      </div>
    </section>
  );
}
