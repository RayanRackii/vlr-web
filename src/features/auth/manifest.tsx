import type { ReactElement } from "react"
import { lazyPage } from "@/routes/lazyPage"
import { Navigate } from "react-router-dom"

const LoginPage = lazyPage(() => import("@/features/auth/LoginPage"), "LoginPage")
const ResetPasswordPage = lazyPage(() => import("@/features/auth/ResetPasswordPage"), "ResetPasswordPage")
const SetPasswordPage = lazyPage(() => import("@/features/auth/SetPasswordPage"), "SetPasswordPage")


type FeatureRoute = { path: string; element: ReactElement }

export const authManifest = {
  modules: [],
  navigationItems: [],
  routes: { public: [
    { path: "/login", element: <LoginPage /> },
    {
      path: "/forgot-password",
      element: <Navigate to="/login?forgot=1" replace />,
    },
    { path: "/reset-password", element: <ResetPasswordPage /> },
    { path: "/invite", element: <SetPasswordPage /> },
  ] satisfies readonly FeatureRoute[] },
} as const
