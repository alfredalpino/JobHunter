import type { Metadata } from "next";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { HuntApp } from "@/components/HuntApp";

export const metadata: Metadata = {
  title: "Hunt",
  description:
    "Upload your resume, tune filters, and review fresh job matches in one workspace. No auto-apply.",
};

export default function AppPage() {
  return (
    <div className="flex min-h-svh flex-col bg-ink">
      <SiteHeader />
      <div className="atmosphere flex flex-1 flex-col">
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8 md:px-10 md:py-10">
          <HuntApp />
        </main>
        <SiteFooter />
      </div>
    </div>
  );
}
