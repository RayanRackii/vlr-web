import type { ReactElement } from "react"
import { lazyPage } from "@/routes/lazyPage"
import { Navigate } from "react-router-dom"

const LandingPage = lazyPage(() => import("@/features/landing/pages/LandingPage"), "LandingPage")
const PricingPage = lazyPage(() => import("@/features/landing/pages/PricingPage"), "PricingPage")
const ArenasPage = lazyPage(() => import("@/features/landing/pages/VerticalLandingPage"), "ArenasPage")
const PmocPage = lazyPage(() => import("@/features/landing/pages/VerticalLandingPage"), "PmocPage")


type FeatureRoute = { path: string; element: ReactElement }

export const landingManifest = {
  modules: [],
  navigationItems: [],
  routes: { public: [
    { path: "/", element: <LandingPage /> },
    { path: "/landing", element: <Navigate to="/" replace /> },
    { path: "/precos", element: <PricingPage /> },
    { path: "/arenas", element: <ArenasPage /> },
    { path: "/pmoc", element: <PmocPage /> },
  ] satisfies readonly FeatureRoute[] },
} as const
