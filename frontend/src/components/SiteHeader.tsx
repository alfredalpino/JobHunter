import Image from "next/image";
import Link from "next/link";

const links = [
  { href: "/#how", label: "How it works" },
  { href: "/#preferences", label: "Preferences" },
  { href: "/app", label: "Open app" },
];

export function SiteHeader() {
  return (
    <header className="relative z-20 flex items-center justify-between gap-6 px-6 py-5 md:px-10">
      <Link href="/" className="focus-ring group flex items-center gap-3 rounded-sm">
        <Image
          src="/logo.png"
          alt="JobHunter"
          width={40}
          height={40}
          className="rounded-xl shadow-[0_0_0_1px_rgba(94,196,176,0.25)]"
          priority
        />
        <span className="leading-tight">
          <span className="block font-[family-name:var(--font-fraunces)] text-lg tracking-tight text-sand">
            JobHunter
          </span>
          <span className="block text-[11px] uppercase tracking-[0.18em] text-sand-muted">
            by Alfredterminal
          </span>
        </span>
      </Link>
      <nav className="hidden items-center gap-7 text-sm text-sand-muted md:flex">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="focus-ring rounded-sm transition-colors hover:text-sand"
          >
            {link.label}
          </Link>
        ))}
        <Link
          href="/app"
          className="focus-ring rounded-full bg-copper px-4 py-2 font-medium text-ink transition-transform hover:-translate-y-0.5"
        >
          Get started
        </Link>
      </nav>
      <Link
        href="/app"
        className="focus-ring rounded-full bg-copper px-4 py-2 text-sm font-medium text-ink md:hidden"
      >
        Get started
      </Link>
    </header>
  );
}
