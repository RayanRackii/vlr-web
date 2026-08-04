import { useMemo } from "react"
import { Navigate, Route, Routes } from "react-router-dom"

import { MainLayout } from "@/components/layout/MainLayout"
import { PlatformAdminRoute } from "@/components/layout/PlatformAdminRoute"
import { ProtectedRoute } from "@/components/layout/ProtectedRoute"
import { AdminDashboardPage } from "@/features/admin/pages/AdminDashboardPage"
import { EditTenantPage } from "@/features/admin/pages/EditTenantPage"
import { NewTenantPage } from "@/features/admin/pages/NewTenantPage"
import { LoginPage } from "@/features/auth/LoginPage"
import { SetPasswordPage } from "@/features/auth/SetPasswordPage"
import { AssetCategoriesPage } from "@/features/assets/pages/AssetCategoriesPage"
import { AssetsPage } from "@/features/assets/pages/AssetsPage"
import { DashboardPage } from "@/features/dashboard/pages/DashboardPage"
import { LandingPage } from "@/features/landing/pages/LandingPage"
import { OnboardingPage } from "@/features/onboarding/OnboardingPage"
import { CreatePlanPage } from "@/features/pmoc/pages/CreatePlanPage"
import { MaintenancePlansPage } from "@/features/pmoc/pages/MaintenancePlansPage"
import { TenantPortalLayout } from "@/features/tenantPortal/components/TenantPortalLayout"
import { TenantPortalHomePage } from "@/features/tenantPortal/pages/TenantPortalHomePage"
import { TenantPortalLoginPage } from "@/features/tenantPortal/pages/TenantPortalLoginPage"
import { TenantPortalRegisterPage } from "@/features/tenantPortal/pages/TenantPortalRegisterPage"
import { TenantPortalVerifyPhonePage } from "@/features/tenantPortal/pages/TenantPortalVerifyPhonePage"
import { getHostTenantSubdomain } from "@/features/tenantPortal/services/tenantPortalService"
import { WorkOrderExecutionPage } from "@/features/workOrders/pages/WorkOrderExecutionPage"
import { CreateWorkOrderPage } from "@/features/workOrders/pages/CreateWorkOrderPage"
import { WorkOrdersPage } from "@/features/workOrders/pages/WorkOrdersPage"

export function AppRoutes() {
  const hostSubdomain = useMemo(() => getHostTenantSubdomain(), [])

  // Host mode: ficc.rolvix.com.br → portal branded (sem landing).
  if (hostSubdomain) {
    return (
      <Routes>
        <Route element={<TenantPortalLayout />}>
          <Route index element={<TenantPortalLoginPage />} />
          <Route path="register" element={<TenantPortalRegisterPage />} />
          <Route path="verify-phone" element={<TenantPortalVerifyPhonePage />} />
          <Route path="app" element={<TenantPortalHomePage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    )
  }

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/landing" element={<Navigate to="/" replace />} />
      <Route path="/onboarding" element={<OnboardingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/invite" element={<SetPasswordPage />} />

      <Route path="/t/:subdomain" element={<TenantPortalLayout />}>
        <Route index element={<TenantPortalLoginPage />} />
        <Route path="register" element={<TenantPortalRegisterPage />} />
        <Route path="verify-phone" element={<TenantPortalVerifyPhonePage />} />
        <Route path="app" element={<TenantPortalHomePage />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<PlatformAdminRoute />}>
          <Route path="/admin/tenants/new" element={<NewTenantPage />} />
          <Route path="/admin/tenants/:id/edit" element={<EditTenantPage />} />
        </Route>

        <Route element={<MainLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/ativos" element={<AssetsPage />} />
          <Route path="/ativos/categorias" element={<AssetCategoriesPage />} />
          <Route path="/pmoc" element={<MaintenancePlansPage />} />
          <Route path="/pmoc/novo" element={<CreatePlanPage />} />
          <Route path="/os" element={<WorkOrdersPage />} />
          <Route path="/os/nova" element={<CreateWorkOrderPage />} />
          <Route path="/os/:id" element={<WorkOrderExecutionPage />} />

          <Route element={<PlatformAdminRoute />}>
            <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
