import type { Metadata } from "next";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { HuntApp } from "@/components/HuntApp";

export const metadata: Metadata = {
  title: "App",
  description:
    "Analyze a resume, set region and preferences, hunt fresh ≤14-day jobs. No auto-apply.",
};

export default function AppPage() {
  return (
    <div className="atmosphere flex min-h-full flex-1 flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-12 md:px-10">
        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-seafoam">
          Operable app
        </p>
        <h1 className="mt-3 font-[family-name:var(--font-fraunces)] text-4xl font-light tracking-tight text-sand">
          Hunt from the browser
        </h1>
        <p className="mt-4 max-w-2xl text-sand-muted">
          Resume → region → preferences → fresh matches. Filters run in TypeScript
          (recency ≤14 days, seniority guardrails, skill synonyms). Public job
          APIs power the search on Vercel — the Python CLI stays available for
          deeper local scrapes.
        </p>
        <div className="mt-12">
          <HuntApp />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
