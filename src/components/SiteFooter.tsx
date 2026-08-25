"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandLogo } from "@/components/BrandLogo";

export function SiteFooter() {
  const pathname = usePathname();
  const inApp = pathname === "/app" || pathname.startsWith("/app/");

  return (
    <footer className="bg-[rgba(7,20,24,0.35)] px-4 py-8 backdrop-blur-md sm:px-6 md:px-10 md:py-10">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-4">
            <BrandLogo variant="full" className="h-16 w-16 shrink-0 sm:h-20 sm:w-20 md:h-24 md:w-24" />
            <div>
              <p className="font-[family-name:var(--font-fraunces)] text-xl text-sand">
                Job<span className="text-seafoam">Hunter</span>
              </p>
              <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-copper/90">
                By Alfred Alpino
              </p>
              <p className="mt-3 max-w-sm text-sm text-sand-muted">
                Fresh jobs. Your resume. Your move. Open source — no auto-apply.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-base text-sand-muted sm:flex sm:flex-wrap sm:gap-5">
            {!inApp ? (
              <>
                <Link href="/app" className="focus-ring min-h-[44px] py-1 hover:text-sand">
                  Get started
                </Link>
                <Link href="/#how" className="focus-ring min-h-[44px] py-1 hover:text-sand">
                  How it works
                </Link>
                <Link href="/#pricing" className="focus-ring min-h-[44px] py-1 hover:text-sand">
                  Pricing
                </Link>
                <Link href="/#preferences" className="focus-ring min-h-[44px] py-1 hover:text-sand">
                  Preferences
                </Link>
              </>
            ) : null}
            {!inApp ? null : (
              <Link href="/#about" className="focus-ring min-h-[44px] py-1 hover:text-sand">
                About
              </Link>
            )}
            <Link href="/status" className="focus-ring min-h-[44px] py-1 hover:text-sand">
              Status
            </Link>
            <a
              href="https://github.com/alfredalpino/JobHunter"
              className="focus-ring min-h-[44px] py-1 hover:text-sand"
              target="_blank"
              rel="noreferrer"
            >
              GitHub
            </a>
            <a
              href="https://alubaid.xyz"
              className="focus-ring min-h-[44px] py-1 hover:text-sand"
              target="_blank"
              rel="noreferrer"
            >
              alubaid.xyz
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
