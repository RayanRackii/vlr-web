import { ClosingSection } from "@/features/landing/components/ClosingSection"
import { HeroSection } from "@/features/landing/components/HeroSection"
import { IntelligenceHubBridge } from "@/features/landing/components/IntelligenceHubBridge"
import { LandingFooter } from "@/features/landing/components/LandingFooter"
import { LandingHeader } from "@/features/landing/components/LandingHeader"
import { MasterScrollStage } from "@/features/landing/components/MasterScrollStage"
import { PricingSection } from "@/features/landing/components/PricingSection"

export function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <LandingHeader />

      <main className="pt-16">
        <HeroSection />
        <IntelligenceHubBridge />
        <MasterScrollStage />
        <PricingSection />
        <ClosingSection />
      </main>

      <LandingFooter />
    </div>
  )
}
