import type { Metadata } from "next";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { StatusBoard } from "@/components/StatusBoard";

export const metadata: Metadata = {
  title: "Status",
  description:
    "Live JobHunter API readiness — uptime for health, regions, analyze, hunt, polish, and deep hunt.",
};

export default function StatusPage() {
  return (
    <div className="atmosphere flex min-h-full flex-col">
      <div className="horizon" aria-hidden />
      <SiteHeader />
      <main className="relative z-10 flex-1 pt-8 md:pt-14">
        <StatusBoard />
      </main>
      <SiteFooter />
    </div>
  );
}
