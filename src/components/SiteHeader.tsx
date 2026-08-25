"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { BrandLogo } from "@/components/BrandLogo";

const links = [
  { href: "/#how", label: "How it works" },
  { href: "/#pricing", label: "Pricing" },
  { href: "/#preferences", label: "Preferences" },
  { href: "/status", label: "Status" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const inApp = pathname === "/app" || pathname.startsWith("/app/");
  const [menuOpen, setMenuOpen] = useState(false);

  const closeMenu = useCallback(() => setMenuOpen(false), []);

  useEffect(() => {
    closeMenu();
  }, [pathname, closeMenu]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMenu();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen, closeMenu]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const onChange = () => {
      if (mq.matches) closeMenu();
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [closeMenu]);

  return (
    <header className="glass-nav relative z-30 grid shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 pb-2.5 pt-[max(0.625rem,env(safe-area-inset-top))] sm:gap-3 sm:px-6 md:px-10 md:pb-3">
      <Link
        href="/"
        className="focus-ring group col-start-1 justify-self-start rounded-sm"
        aria-label="JobHunter by Alfred Alpino — home"
      >
        <BrandLogo
          variant="full"
          priority
          className="h-12 w-12 transition-transform duration-200 group-hover:scale-[1.02] sm:h-14 sm:w-14 md:h-[4.4rem] md:w-[4.4rem]"
        />
      </Link>

      <nav
        className="header-nav header-nav-desktop col-start-2 items-center justify-center gap-5 md:gap-6"
        aria-label="Main"
      >
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="focus-ring rounded-sm whitespace-nowrap transition-colors hover:text-sand"
          >
            {link.label}
          </Link>
        ))}
      </nav>

      <div className="col-start-3 flex items-center justify-end gap-2 justify-self-end sm:gap-3">
        <button
          type="button"
          className="header-menu-toggle focus-ring"
          aria-expanded={menuOpen}
          aria-controls="mobile-nav"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span className="sr-only">{menuOpen ? "Close" : "Menu"}</span>
          <svg
            aria-hidden
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            {menuOpen ? (
              <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
            ) : (
              <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
            )}
          </svg>
        </button>

        {!inApp ? (
          <Link
            href="/app"
            className="focus-ring glass-btn-primary header-cta header-cta-desktop min-h-[44px] shrink-0 items-center px-4 py-2"
          >
            Get started
          </Link>
        ) : (
          <span
            className="glass-badge header-badge inline-flex min-h-[44px] shrink-0 items-center px-3 py-2 font-medium uppercase tracking-[0.14em] text-seafoam md:px-4"
            aria-current="page"
          >
            In app
          </span>
        )}
      </div>

      {menuOpen ? (
        <>
          <button
            type="button"
            className="mobile-nav-overlay fixed inset-0 z-40 bg-[rgba(7,20,24,0.72)] backdrop-blur-sm"
            aria-label="Close menu"
            onClick={closeMenu}
          />
          <nav
            id="mobile-nav"
            className="mobile-nav-panel fixed left-4 right-4 top-[calc(4.5rem+env(safe-area-inset-top))] z-50 flex flex-col gap-1 p-2"
            aria-label="Mobile"
          >
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={closeMenu}
                className="focus-ring rounded-xl px-4 py-3.5 text-base text-sand transition-colors hover:bg-[rgba(94,196,176,0.08)]"
              >
                {link.label}
              </Link>
            ))}
            {!inApp ? (
              <Link
                href="/app"
                onClick={closeMenu}
                className="focus-ring glass-btn-primary header-cta mt-2 inline-flex min-h-[48px] items-center justify-center rounded-xl px-4 py-3"
              >
                Get started
              </Link>
            ) : null}
          </nav>
        </>
      ) : null}
    </header>
  );
}
