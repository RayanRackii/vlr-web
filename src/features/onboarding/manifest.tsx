import type { ReactElement } from "react"
import { lazyPage } from "@/routes/lazyPage"

const OnboardingPage = lazyPage(() => import("@/features/onboarding/OnboardingPage"), "OnboardingPage")


type FeatureRoute = { path: string; element: ReactElement }

export const onboardingManifest = {
  modules: [],
  navigationItems: [],
  routes: { public: [
    { path: "/onboarding", element: <OnboardingPage /> },
  ] satisfies readonly FeatureRoute[] },
} as const
