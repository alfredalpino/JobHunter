import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { RegionPicker } from "@/components/RegionPicker";
import { AnalyzePanel } from "@/components/AnalyzePanel";

export const metadata: Metadata = {
  title: "App",
  description:
    "JobHunter app shell — analyze a resume, pick a region, connect to the local CLI later.",
};

export default function AppPage() {
  return (
    <div className="atmosphere flex min-h-full flex-1 flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-12 md:px-10">
        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-seafoam">
          App shell
        </p>
        <h1 className="mt-3 font-[family-name:var(--font-fraunces)] text-4xl font-light tracking-tight text-sand">
          Start close to the CLI
        </h1>
        <p className="mt-4 max-w-2xl text-sand-muted">
          This web shell explains the same flow as{" "}
          <code className="text-sand">./run.sh</code>. Full scrape and scoring
          still run on your machine today. API stubs below show how a hosted
          alfredterminal.xyz backend can plug in later — without breaking the
          Python tools.
        </p>

        <div className="mt-12 grid gap-10 lg:grid-cols-2">
          <AnalyzePanel />
          <RegionPicker />
        </div>

        <section className="mt-14 rounded-2xl border border-[var(--line)] bg-ink-mid/40 p-6">
          <h2 className="text-lg font-medium text-sand">Run locally (today)</h2>
          <pre className="mt-4 overflow-x-auto text-xs leading-relaxed text-seafoam">
            {`./setup-once.sh
./run.sh easy --resume "uploads/cv.pdf" --name "Your Name" --region dubai
./run.sh easy-hunt --id your-name
# Results: data/exports/<id>/eligible.md`}
          </pre>
          <p className="mt-4 text-sm text-sand-muted">
            Prefer the simple Mac launcher? Double-click{" "}
            <code className="text-sand">Open JobHunter.command</code> after
            setup.
          </p>
          <Link
            href="/#preferences"
            className="focus-ring mt-4 inline-flex text-sm text-copper hover:underline"
          >
            How preferences.yaml works →
          </Link>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
