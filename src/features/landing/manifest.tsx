import type { ReactElement } from "react"
import { Navigate } from "react-router-dom"

import { LandingPage } from "@/features/landing/pages/LandingPage"

type FeatureRoute = { path: string; element: ReactElement }

export const landingManifest = {
  modules: [],
  navigationItems: [],
  routes: { public: [
    { path: "/", element: <LandingPage /> },
    { path: "/landing", element: <Navigate to="/" replace /> },
  ] satisfies readonly FeatureRoute[] },
} as const
