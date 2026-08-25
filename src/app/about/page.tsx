import type { Metadata } from "next";
import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: "About",
  description:
    "Why Alfred Alpino built JobHunter — a resume-first, fresh-job hunt tool with no auto-apply.",
};

const values = [
  {
    title: "Freshness",
    body: "Default recency ≤14 days. Stale reposts are noise.",
  },
  {
    title: "Fit over volume",
    body: "Eligibility scoring, seniority guardrails, exclude keywords.",
  },
  {
    title: "Human control",
    body: "You open links and apply. The tool never crosses that line.",
  },
  {
    title: "Honesty",
    body: "Deterministic filters in the browser. AI is optional polish only.",
  },
];

export default function AboutPage() {
  return (
    <div className="flex min-h-svh flex-col bg-ink">
      <SiteHeader />
      <div className="atmosphere flex flex-1 flex-col">
        <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12 md:px-10 md:py-16">
          <BrandLogo variant="full" className="h-28 w-28 md:h-32 md:w-32" />
          <p className="mt-6 text-sm font-medium text-seafoam">About JobHunter</p>
          <h1 className="mt-3 font-[family-name:var(--font-fraunces)] text-4xl font-light tracking-tight text-sand md:text-5xl">
            Built for real hunts
          </h1>

          <div className="mt-8 space-y-5 text-base leading-relaxed text-sand-muted">
            <p>
              JobHunter is an open-source tool I built while navigating real job
              markets — especially when freshness and fit matter more than volume.
              Boards were full of stale reposts. “AI job tools” wanted to auto-apply
              everywhere. I kept losing hours scrolling instead of applying well.
            </p>
            <p>
              This is the product I wished existed: start from your resume, cut the
              noise, surface only recent roles that actually fit, and leave every
              application decision in your hands.{" "}
              <strong className="font-medium text-sand">No auto-apply. Ever.</strong>
            </p>
            <p>
              I ship it as a browser app anyone can run, with an optional Python CLI
              on the <code className="text-sand">cli-local</code> branch for deeper
              scrapes. The logic is honest and deterministic — AI is optional polish,
              not the engine.
            </p>
          </div>

          <p className="mt-10 font-[family-name:var(--font-fraunces)] text-xl text-sand">
            — Alfred Alpino
          </p>
          <Link
            href="https://alubaid.xyz"
            target="_blank"
            rel="noreferrer"
            className="focus-ring mt-2 inline-block text-sm text-copper hover:underline"
          >
            alubaid.xyz
          </Link>

          <section className="mt-14">
            <h2 className="font-[family-name:var(--font-fraunces)] text-2xl font-light text-sand">
              What we believe
            </h2>
            <ul className="mt-6 grid gap-4 sm:grid-cols-2">
              {values.map((v) => (
                <li key={v.title} className="glass-card p-5">
                  <h3 className="font-medium text-sand">{v.title}</h3>
                  <p className="mt-2 text-sm text-sand-muted">{v.body}</p>
                </li>
              ))}
            </ul>
          </section>

          <section className="glass-panel mt-14 p-6">
            <h2 className="font-[family-name:var(--font-fraunces)] text-2xl font-light text-sand">
              Brand & logo
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-sand-muted">
              JobHunter is a resume-first filter, not a job board. The metaphor is a
              hunter’s scope on a fresh target — precision, freshness, and your move.
              Colors: seafoam signal, copper action, ink focus.
            </p>
            <p className="mt-4 text-sm text-sand-muted">
              Full brand story and logo brief for designers:{" "}
              <code className="text-sand">docs/BRAND.md</code> in the repository.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/app" className="focus-ring glass-btn-primary px-5 py-2.5 text-sm">
                Get started
              </Link>
              <a
                href="https://github.com/alfredalpino/JobHunter/blob/main/docs/BRAND.md"
                target="_blank"
                rel="noreferrer"
                className="focus-ring glass-btn-ghost px-5 py-2.5 text-sm"
              >
                Read BRAND.md
              </a>
            </div>
          </section>
        </main>
        <SiteFooter />
      </div>
    </div>
  );
}
