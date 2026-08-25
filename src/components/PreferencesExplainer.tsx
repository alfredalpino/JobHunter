import Link from "next/link";

export function PreferencesExplainer() {
  return (
    <section
      id="preferences"
      className="border-t border-[var(--glass-border)] px-4 py-16 sm:px-6 sm:py-20 md:px-10"
    >
      <div className="mx-auto max-w-5xl">
        <h2 className="font-[family-name:var(--font-fraunces)] text-3xl font-light tracking-tight text-sand md:text-4xl">
          Preferences, in plain English
        </h2>
        <p className="mt-3 max-w-2xl text-lg text-sand-muted">
          In the app you edit a simple form that writes preferences.yaml. Same
          fields as the CLI — region, cities, seniority, skills to require, titles
          to skip. Stored in your browser; download anytime.
        </p>
        <div className="mt-10 grid gap-8 md:grid-cols-2">
          <div className="glass-card p-6">
            <h3 className="text-sm font-medium uppercase tracking-[0.16em] text-seafoam">
              In the app
            </h3>
            <p className="mt-3 font-mono text-base text-sand">
              /app → Preferences → preferences.yaml
            </p>
            <p className="mt-4 text-base leading-relaxed text-sand-muted">
              Power users can still use{" "}
              <code className="text-sand">aspirants/&lt;id&gt;/preferences.yaml</code>{" "}
              with <code className="text-sand">./run.sh</code> locally.
            </p>
            <Link
              href="/app"
              className="focus-ring mt-6 inline-flex text-sm font-medium text-copper hover:underline"
            >
              Get started →
            </Link>
          </div>
          <pre className="glass-code overflow-x-auto p-5 text-sm leading-relaxed text-seafoam">
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
