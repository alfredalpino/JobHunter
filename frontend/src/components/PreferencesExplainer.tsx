import Link from "next/link";

export function PreferencesExplainer() {
  return (
    <section
      id="preferences"
      className="border-t border-[var(--line)] px-6 py-20 md:px-10"
    >
      <div className="mx-auto max-w-5xl">
        <h2 className="font-[family-name:var(--font-fraunces)] text-3xl font-light tracking-tight text-sand md:text-4xl">
          Preferences, in plain English
        </h2>
        <p className="mt-3 max-w-2xl text-sand-muted">
          In the app you edit a simple form that writes preferences.yaml. Same
          fields as the CLI — region, cities, seniority, skills to require, titles
          to skip. Stored in your browser; download anytime.
        </p>
        <div className="mt-10 grid gap-8 md:grid-cols-2">
          <div>
            <h3 className="text-sm font-medium uppercase tracking-[0.16em] text-seafoam">
              In the app
            </h3>
            <p className="mt-3 font-mono text-sm text-sand">
              /app → Preferences → preferences.yaml
            </p>
            <p className="mt-4 text-sm leading-relaxed text-sand-muted">
              Power users can still use{" "}
              <code className="text-sand">aspirants/&lt;id&gt;/preferences.yaml</code>{" "}
              with <code className="text-sand">./run.sh</code> locally.
            </p>
            <Link
              href="/app"
              className="focus-ring mt-6 inline-flex text-sm font-medium text-copper hover:underline"
            >
              Open the app →
            </Link>
          </div>
          <pre className="overflow-x-auto rounded-2xl border border-[var(--line)] bg-ink-mid/60 p-5 text-xs leading-relaxed text-seafoam shadow-[inset_0_0_40px_var(--glow)]">
            {`region: dubai
locations:
  - Dubai
  - UAE
seniority_band: junior
work_mode: any
recency_max_days: 14`}
          </pre>
        </div>
      </div>
    </section>
  );
}
