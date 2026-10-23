import type { ReactElement } from "react"

import type { AppNavigationItem } from "@/components/layout/navigation"
import { TenantPortalAgendaPage } from "@/features/tenantPortal/pages/TenantPortalAgendaPage"
import { TenantPortalForgotPasswordPage } from "@/features/tenantPortal/pages/TenantPortalForgotPasswordPage"
import { TenantPortalHomePage } from "@/features/tenantPortal/pages/TenantPortalHomePage"
import { TenantPortalLoginPage } from "@/features/tenantPortal/pages/TenantPortalLoginPage"
import { TenantPortalProfilePage } from "@/features/tenantPortal/pages/TenantPortalProfilePage"
import { TenantPortalRegisterPage } from "@/features/tenantPortal/pages/TenantPortalRegisterPage"
import { TenantPortalResetPasswordPage } from "@/features/tenantPortal/pages/TenantPortalResetPasswordPage"
import { TenantPortalVerifyEmailPage } from "@/features/tenantPortal/pages/TenantPortalVerifyEmailPage"

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
      { path: "register", element: <TenantPortalRegisterPage /> },
      { path: "verify-email", element: <TenantPortalVerifyEmailPage /> },
      { path: "verify-phone", redirectToEmail: true },
      { path: "forgot-password", element: <TenantPortalForgotPasswordPage /> },
      {
        path: "forgot-password/confirm",
        element: <TenantPortalResetPasswordPage />,
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
