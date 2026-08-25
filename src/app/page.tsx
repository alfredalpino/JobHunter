import { AboutStory } from "@/components/AboutStory";
import { Hero } from "@/components/Hero";
import { HowItWorks } from "@/components/HowItWorks";
import { PreferencesExplainer } from "@/components/PreferencesExplainer";
import { Pricing } from "@/components/Pricing";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { TruthStrip } from "@/components/TruthStrip";

export default function HomePage() {
  return (
    <div className="landing-page flex min-h-svh flex-col bg-ink">
      <SiteHeader />
      <div className="atmosphere home-page flex flex-1 flex-col">
        <main className="flex-1">
          <Hero />
          <HowItWorks />
          <PreferencesExplainer />
          <Pricing />
          <AboutStory />
          <TruthStrip />
        </main>
        <SiteFooter />
      </div>
    </div>
  );
}
