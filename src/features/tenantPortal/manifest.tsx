import type { ReactElement } from "react"
import { lazyPage } from "@/routes/lazyPage"

import type { AppNavigationItem } from "@/components/layout/navigation"

const TenantPortalAgendaPage = lazyPage(() => import("@/features/tenantPortal/pages/TenantPortalAgendaPage"), "TenantPortalAgendaPage")
const TenantPortalForgotPasswordPage = lazyPage(() => import("@/features/tenantPortal/pages/TenantPortalForgotPasswordPage"), "TenantPortalForgotPasswordPage")
const TenantPortalHomePage = lazyPage(() => import("@/features/tenantPortal/pages/TenantPortalHomePage"), "TenantPortalHomePage")
const TenantPortalInvalidResetLinkPage = lazyPage(() => import("@/features/tenantPortal/pages/TenantPortalInvalidResetLinkPage"), "TenantPortalInvalidResetLinkPage")
const TenantPortalLoginPage = lazyPage(() => import("@/features/tenantPortal/pages/TenantPortalLoginPage"), "TenantPortalLoginPage")
const TenantPortalLoginRedirectRoute = lazyPage(() => import("@/features/tenantPortal/pages/TenantPortalLoginRedirectRoute"), "TenantPortalLoginRedirectRoute")
const TenantPortalProfilePage = lazyPage(() => import("@/features/tenantPortal/pages/TenantPortalProfilePage"), "TenantPortalProfilePage")
const TenantPortalRegisterPage = lazyPage(() => import("@/features/tenantPortal/pages/TenantPortalRegisterPage"), "TenantPortalRegisterPage")
const TenantPortalResetPasswordPage = lazyPage(() => import("@/features/tenantPortal/pages/TenantPortalResetPasswordPage"), "TenantPortalResetPasswordPage")
const TenantPortalVerifyEmailPage = lazyPage(() => import("@/features/tenantPortal/pages/TenantPortalVerifyEmailPage"), "TenantPortalVerifyEmailPage")

type FeatureRoute =
  | {
      path?: string
      element: ReactElement
      redirectToEmail?: never
    }
  | {
      path: "verify-phone"
      redirectToEmail: true
      element?: never
    }

export const tenantPortalManifest = {
  modules: ["rentals"],
  permissions: [],
  navigationItems: [] satisfies readonly AppNavigationItem[],
  routes: {
    public: [
      { element: <TenantPortalLoginPage /> },
      { path: "login", element: <TenantPortalLoginRedirectRoute /> },
      { path: "register", element: <TenantPortalRegisterPage /> },
      { path: "verify-email", element: <TenantPortalVerifyEmailPage /> },
      { path: "verify-phone", redirectToEmail: true },
      { path: "forgot-password", element: <TenantPortalForgotPasswordPage /> },
      {
        path: "forgot-password/confirm",
        element: <TenantPortalResetPasswordPage />,
      },
      {
        path: "reset-password",
        element: <TenantPortalInvalidResetLinkPage />,
      },
    ] satisfies readonly FeatureRoute[],
    customer: [
      { path: "app", element: <TenantPortalHomePage /> },
      { path: "app/perfil", element: <TenantPortalProfilePage /> },
      { path: "agenda", element: <TenantPortalAgendaPage /> },
      { path: "agenda/:menuItemId", element: <TenantPortalAgendaPage /> },
    ] satisfies readonly FeatureRoute[],
  },
} as const
