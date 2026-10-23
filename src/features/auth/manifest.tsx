import type { ReactElement } from "react"

import { LoginPage } from "@/features/auth/LoginPage"
import { ResetPasswordPage } from "@/features/auth/ResetPasswordPage"
import { SetPasswordPage } from "@/features/auth/SetPasswordPage"

type FeatureRoute = { path: string; element: ReactElement }

export const authManifest = {
  modules: [],
  navigationItems: [],
  routes: { public: [
    { path: "/login", element: <LoginPage /> },
    { path: "/reset-password", element: <ResetPasswordPage /> },
    { path: "/invite", element: <SetPasswordPage /> },
  ] satisfies readonly FeatureRoute[] },
} as const
