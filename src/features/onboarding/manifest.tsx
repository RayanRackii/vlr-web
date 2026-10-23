import type { ReactElement } from "react"

import { OnboardingPage } from "@/features/onboarding/OnboardingPage"

type FeatureRoute = { path: string; element: ReactElement }

export const onboardingManifest = {
  modules: [],
  navigationItems: [],
  routes: { public: [
    { path: "/onboarding", element: <OnboardingPage /> },
  ] satisfies readonly FeatureRoute[] },
} as const
