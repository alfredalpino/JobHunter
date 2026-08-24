import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-[var(--line)] px-6 py-10 md:px-10">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 text-sm text-sand-muted md:flex-row md:items-center md:justify-between">
        <p>
          JobHunter · Alfredterminal — open source, no auto-apply. You decide what
          to send.
        </p>
        <div className="flex flex-wrap gap-5">
          <Link href="/app" className="focus-ring hover:text-sand">
            Open app
          </Link>
          <Link href="/status" className="focus-ring hover:text-sand">
            Status
          </Link>
          <a
            href="https://github.com/alfredalpino/JobHunter"
            className="focus-ring hover:text-sand"
            target="_blank"
            rel="noreferrer"
          >
            GitHub
          </a>
          <a
            href="https://alfredterminal.xyz"
            className="focus-ring hover:text-sand"
          >
            alfredterminal.xyz
          </a>
        </div>
      </div>
    </footer>
  );
}
