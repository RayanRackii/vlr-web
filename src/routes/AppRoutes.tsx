import { Navigate, Route, Routes } from "react-router-dom"

import { MainLayout } from "@/components/layout/MainLayout"
import { PlatformAdminRoute } from "@/components/layout/PlatformAdminRoute"
import { ProtectedRoute } from "@/components/layout/ProtectedRoute"
import { AdminDashboardPage } from "@/features/admin/pages/AdminDashboardPage"
import { EditTenantPage } from "@/features/admin/pages/EditTenantPage"
import { NewTenantPage } from "@/features/admin/pages/NewTenantPage"
import { LoginPage } from "@/features/auth/LoginPage"
import { AssetCategoriesPage } from "@/features/assets/pages/AssetCategoriesPage"
import { AssetsPage } from "@/features/assets/pages/AssetsPage"
import { DashboardPage } from "@/features/dashboard/pages/DashboardPage"
import { OnboardingPage } from "@/features/onboarding/OnboardingPage"
import { CreatePlanPage } from "@/features/pmoc/pages/CreatePlanPage"
import { MaintenancePlansPage } from "@/features/pmoc/pages/MaintenancePlansPage"
import { WorkOrderExecutionPage } from "@/features/workOrders/pages/WorkOrderExecutionPage"
import { WorkOrdersPage } from "@/features/workOrders/pages/WorkOrdersPage"

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/onboarding" element={<OnboardingPage />} />
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<PlatformAdminRoute />}>
          <Route path="/admin/tenants/new" element={<NewTenantPage />} />
        </Route>

        <Route element={<MainLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/ativos" element={<AssetsPage />} />
          <Route path="/ativos/categorias" element={<AssetCategoriesPage />} />
          <Route path="/pmoc" element={<MaintenancePlansPage />} />
          <Route path="/pmoc/novo" element={<CreatePlanPage />} />
          <Route path="/os" element={<WorkOrdersPage />} />
          <Route path="/os/:id" element={<WorkOrderExecutionPage />} />

          <Route element={<PlatformAdminRoute />}>
            <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
            <Route path="/admin/tenants/:id/edit" element={<EditTenantPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/onboarding" replace />} />
    </Routes>
  )
}
