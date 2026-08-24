import { Hero } from "@/components/Hero";
import { HowItWorks } from "@/components/HowItWorks";
import { PreferencesExplainer } from "@/components/PreferencesExplainer";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { TruthStrip } from "@/components/TruthStrip";

export default function HomePage() {
  return (
    <div className="atmosphere flex min-h-full flex-1 flex-col">
      <SiteHeader />
      <main className="flex-1">
        <Hero />
        <HowItWorks />
        <PreferencesExplainer />
        <TruthStrip />
      </main>
      <SiteFooter />
    </div>
  );
}
