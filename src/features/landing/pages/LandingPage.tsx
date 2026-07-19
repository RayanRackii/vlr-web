import { ClosingSection } from "@/features/landing/components/ClosingSection"
import { FeaturesNarrativeSection } from "@/features/landing/components/FeaturesNarrativeSection"
import { HeroSection } from "@/features/landing/components/HeroSection"
import { IntelligenceHubBridge } from "@/features/landing/components/IntelligenceHubBridge"
import { LandingFooter } from "@/features/landing/components/LandingFooter"
import { LandingHeader } from "@/features/landing/components/LandingHeader"
import { PlatformSection } from "@/features/landing/components/PlatformSection"
import { PricingSection } from "@/features/landing/components/PricingSection"
import { SolutionsSection } from "@/features/landing/components/SolutionsSection"

export function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <LandingHeader />

      <main className="pt-16">
        <HeroSection />
        <IntelligenceHubBridge />
        <FeaturesNarrativeSection />
        <SolutionsSection />
        <PlatformSection />
        <PricingSection />
        <ClosingSection />
      </main>

      <LandingFooter />
    </div>
  )
}
