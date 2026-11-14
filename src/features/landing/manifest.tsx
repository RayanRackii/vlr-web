import type { ReactElement } from "react"
import { lazyPage } from "@/routes/lazyPage"
import { Navigate } from "react-router-dom"

const LandingPage = lazyPage(() => import("@/features/landing/pages/LandingPage"), "LandingPage")


type FeatureRoute = { path: string; element: ReactElement }

export const landingManifest = {
  modules: [],
  navigationItems: [],
  routes: { public: [
    { path: "/", element: <LandingPage /> },
    { path: "/landing", element: <Navigate to="/" replace /> },
  ] satisfies readonly FeatureRoute[] },
} as const
