import Link from "next/link";
import { JOB_SOURCE_COUNT_LABEL } from "@/lib/marketing";

const differentiators = [
  { k: `${JOB_SOURCE_COUNT_LABEL} Sources`, v: "Dynamic job discovery" },
  { k: "Resume-first", v: "Matches built around you" },
  { k: "You apply", v: "Never auto-apply" },
] as const;

export function Hero() {
  return (
    <section className="relative flex min-h-[calc(100svh-4rem)] flex-col justify-center px-4 pb-16 pt-8 sm:min-h-[calc(100svh-4.75rem)] sm:px-6 sm:pb-24 sm:pt-10 md:px-10">
      <div className="relative z-10 mx-auto w-full max-w-4xl">
        <p className="rise glass-badge inline-flex px-4 py-1.5 text-[10.72px] font-medium uppercase tracking-[0.22em] text-seafoam">
          JobHunter · Alfred Alpino
        </p>
        <h1 className="rise rise-delay-1 mt-6 max-w-3xl font-[family-name:var(--font-fraunces)] text-[clamp(2.1rem,5.2vw,3.75rem)] font-light leading-[1.08] tracking-tight text-sand">
          We read your resume. Then hunt {JOB_SOURCE_COUNT_LABEL} job sites for your
          best matches.
        </h1>
        <p className="rise rise-delay-2 mt-6 max-w-2xl text-xl leading-relaxed text-sand-muted">
          Upload your resume once. JobHunter analyzes your skills, experience,
          seniority, and preferences, dynamically searches hundreds of job sources,
          and surfaces the roles that fit you best.
        </p>
        <p className="rise rise-delay-2 mt-5 max-w-2xl text-base font-medium leading-relaxed text-sand">
          Fresh listings. Better matches. You make every application decision.
        </p>
        <div className="rise rise-delay-3 mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Link
            href="/app"
            className="focus-ring glass-btn-primary touch-target inline-flex w-full items-center justify-center px-6 py-3.5 text-base sm:w-auto"
          >
            Get started
          </Link>
          <Link
            href="/#preferences"
            className="focus-ring glass-btn-ghost touch-target inline-flex w-full items-center justify-center px-6 py-3.5 text-base font-medium sm:w-auto"
          >
            Prefer region
          </Link>
        </div>
        <div className="rise rise-delay-3 mt-14 grid gap-4 sm:grid-cols-3">
          {differentiators.map((item) => (
            <div key={item.k} className="glass-card p-4">
              <p className="font-[family-name:var(--font-fraunces)] text-xl text-copper">
                {item.k}
              </p>
              <p className="mt-1 text-sm text-sand-muted">{item.v}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
