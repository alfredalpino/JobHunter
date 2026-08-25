import Link from "next/link";

export function AboutStory() {
  return (
    <section
      id="about"
      className="border-t border-[var(--glass-border)] px-4 py-16 sm:px-6 sm:py-20 md:px-10"
    >
      <div className="mx-auto max-w-5xl">
        <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
          <div>
            <p className="text-sm font-medium text-seafoam">Why I built this</p>
            <h2 className="mt-3 font-[family-name:var(--font-fraunces)] text-3xl font-light tracking-tight text-sand md:text-4xl">
              A hunt tool I wanted for myself
            </h2>
            <div className="mt-6 space-y-4 text-base leading-relaxed text-sand-muted md:text-lg">
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
                for deeper hunts. The logic is honest and deterministic — AI is optional
                polish, not the engine.
              </p>
            </div>
            <p className="mt-8 font-[family-name:var(--font-fraunces)] text-lg text-sand">
              — Alfred Alpino
            </p>
            <Link
              href="https://alubaid.xyz"
              target="_blank"
              rel="noreferrer"
              className="focus-ring mt-1 inline-block text-sm text-copper hover:underline"
            >
              alubaid.xyz
            </Link>
          </div>

          <aside className="glass-card space-y-6 p-6">
            <div>
              <h3 className="text-sm font-medium text-seafoam">What we believe</h3>
              <ul className="mt-3 space-y-2 text-base text-sand-muted">
                <li>Fresh listings beat endless feeds</li>
                <li>Fit over volume — fewer roles, better aim</li>
                <li>You apply; the tool never crosses that line</li>
                <li>Open source, built as a tool — not a platform</li>
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-medium text-seafoam">The workflow</h3>
              <ol className="mt-3 space-y-2 text-base text-sand-muted">
                <li>
                  <span className="text-copper">1.</span> Your resume sets the target
                </li>
                <li>
                  <span className="text-copper">2.</span> The hunt finds fresh matches
                </li>
                <li>
                  <span className="text-copper">3.</span> You take the shot
                </li>
              </ol>
            </div>
            <Link
              href="/#about"
              className="focus-ring glass-btn-ghost touch-target mt-2 inline-flex w-full items-center justify-center px-6 py-3 text-sm font-medium sm:w-fit"
            >
              Why I built this
            </Link>
          </aside>
        </div>
      </div>
    </section>
  );
}
