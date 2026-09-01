import { useMemo } from "react"
import { Navigate, Route, Routes } from "react-router-dom"

import { MainLayout } from "@/components/layout/MainLayout"
import { PermissionRoute } from "@/components/layout/PermissionRoute"
import { PlatformAdminRoute } from "@/components/layout/PlatformAdminRoute"
import { ProtectedRoute } from "@/components/layout/ProtectedRoute"
import { AdminDashboardPage } from "@/features/admin/pages/AdminDashboardPage"
import { AdminUsersPage } from "@/features/admin/pages/AdminUsersPage"
import { EditTenantPage } from "@/features/admin/pages/EditTenantPage"
import { NewTenantPage } from "@/features/admin/pages/NewTenantPage"
import { TenantModuleMenuPage } from "@/features/admin/pages/TenantModuleMenuPage"
import { TenantRegistrationFieldsPage } from "@/features/admin/pages/TenantRegistrationFieldsPage"
import { LoginPage } from "@/features/auth/LoginPage"
import { ResetPasswordPage } from "@/features/auth/ResetPasswordPage"
import { SetPasswordPage } from "@/features/auth/SetPasswordPage"
import { AssetCategoriesPage } from "@/features/assets/pages/AssetCategoriesPage"
import { AssetsPage } from "@/features/assets/pages/AssetsPage"
import { DashboardPage } from "@/features/dashboard/pages/DashboardPage"
import { LandingPage } from "@/features/landing/pages/LandingPage"
import { OnboardingPage } from "@/features/onboarding/OnboardingPage"
import { CreatePlanPage } from "@/features/pmoc/pages/CreatePlanPage"
import { MaintenancePlansPage } from "@/features/pmoc/pages/MaintenancePlansPage"
import { ReservationsPage } from "@/features/rentals/pages/ReservationsPage"
import { RentalLayoutsPage } from "@/features/rentals/pages/RentalLayoutsPage"
import { SchedulePage } from "@/features/rentals/pages/SchedulePage"
import { CustomerAppLayout } from "@/features/tenantPortal/components/CustomerAppLayout"
import { TenantPortalLayout } from "@/features/tenantPortal/components/TenantPortalLayout"
import { TenantPortalAgendaPage } from "@/features/tenantPortal/pages/TenantPortalAgendaPage"
import { TenantPortalHomePage } from "@/features/tenantPortal/pages/TenantPortalHomePage"
import { TenantPortalLoginPage } from "@/features/tenantPortal/pages/TenantPortalLoginPage"
import { TenantPortalProfilePage } from "@/features/tenantPortal/pages/TenantPortalProfilePage"
import { TenantPortalRegisterPage } from "@/features/tenantPortal/pages/TenantPortalRegisterPage"
import { TenantPortalVerifyPhonePage } from "@/features/tenantPortal/pages/TenantPortalVerifyPhonePage"
import { CatalogNotificationsPage } from "@/features/catalog/pages/CatalogNotificationsPage"
import { CatalogOrderDetailPage } from "@/features/catalog/pages/CatalogOrderDetailPage"
import { CatalogOrdersPage } from "@/features/catalog/pages/CatalogOrdersPage"
import { CatalogProductsPage } from "@/features/catalog/pages/CatalogProductsPage"
import { PortalCartPage } from "@/features/catalog/pages/PortalCartPage"
import { PortalCatalogPage } from "@/features/catalog/pages/PortalCatalogPage"
import { PortalCatalogProductPage } from "@/features/catalog/pages/PortalCatalogProductPage"
import { PortalOrderDetailPage } from "@/features/catalog/pages/PortalOrderDetailPage"
import { PortalOrdersPage } from "@/features/catalog/pages/PortalOrdersPage"
import { PortalProductRequestPage } from "@/features/catalog/pages/PortalProductRequestPage"
import { getHostTenantSubdomain } from "@/features/tenantPortal/services/tenantPortalService"
import { WorkOrderExecutionPage } from "@/features/workOrders/pages/WorkOrderExecutionPage"
import { CreateWorkOrderPage } from "@/features/workOrders/pages/CreateWorkOrderPage"
import { WorkOrdersPage } from "@/features/workOrders/pages/WorkOrdersPage"
import { PeopleAccessPage } from "@/features/users/pages/PeopleAccessPage"

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
        </Route>
        <Route element={<CustomerAppLayout />}>
          <Route path="app" element={<TenantPortalHomePage />} />
          <Route path="app/perfil" element={<TenantPortalProfilePage />} />
          <Route path="agenda" element={<TenantPortalAgendaPage />} />
          <Route path="agenda/:menuItemId" element={<TenantPortalAgendaPage />} />
          <Route path="catalogo" element={<PortalCatalogPage />} />
          <Route path="catalogo/carrinho" element={<PortalCartPage />} />
          <Route path="catalogo/solicitar" element={<PortalProductRequestPage />} />
          <Route path="catalogo/:productId" element={<PortalCatalogProductPage />} />
          <Route path="pedidos" element={<PortalOrdersPage />} />
          <Route path="pedidos/:orderId" element={<PortalOrderDetailPage />} />
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
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/invite" element={<SetPasswordPage />} />

      <Route path="/t/:subdomain">
        <Route element={<TenantPortalLayout />}>
          <Route index element={<TenantPortalLoginPage />} />
          <Route path="register" element={<TenantPortalRegisterPage />} />
          <Route path="verify-phone" element={<TenantPortalVerifyPhonePage />} />
        </Route>
        <Route element={<CustomerAppLayout />}>
          <Route path="app" element={<TenantPortalHomePage />} />
          <Route path="app/perfil" element={<TenantPortalProfilePage />} />
          <Route path="agenda" element={<TenantPortalAgendaPage />} />
          <Route path="agenda/:menuItemId" element={<TenantPortalAgendaPage />} />
          <Route path="catalogo" element={<PortalCatalogPage />} />
          <Route path="catalogo/carrinho" element={<PortalCartPage />} />
          <Route path="catalogo/solicitar" element={<PortalProductRequestPage />} />
          <Route path="catalogo/:productId" element={<PortalCatalogProductPage />} />
          <Route path="pedidos" element={<PortalOrdersPage />} />
          <Route path="pedidos/:orderId" element={<PortalOrderDetailPage />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<PlatformAdminRoute />}>
          <Route path="/admin/tenants/new" element={<NewTenantPage />} />
          <Route path="/admin/tenants/:id/edit" element={<EditTenantPage />} />
        </Route>

        <Route element={<MainLayout />}>
          <Route element={<PermissionRoute permission="core.dashboard.read" />}>
            <Route path="/dashboard" element={<DashboardPage />} />
          </Route>
          <Route
            element={<PermissionRoute permission="inventory.assets.read" />}
          >
            <Route path="/ativos" element={<AssetsPage />} />
          </Route>
          <Route
            element={
              <PermissionRoute permission="inventory.categories.read" />
            }
          >
            <Route
              path="/ativos/categorias"
              element={<AssetCategoriesPage />}
            />
          </Route>
          <Route element={<PermissionRoute permission="pmoc.plans.read" />}>
            <Route path="/pmoc" element={<MaintenancePlansPage />} />
          </Route>
          <Route element={<PermissionRoute permission="pmoc.plans.write" />}>
            <Route path="/pmoc/novo" element={<CreatePlanPage />} />
          </Route>
          <Route
            element={<PermissionRoute permission="os.work_orders.read" />}
          >
            <Route path="/os" element={<WorkOrdersPage />} />
            <Route path="/os/:id" element={<WorkOrderExecutionPage />} />
          </Route>
          <Route
            element={<PermissionRoute permission="os.work_orders.create" />}
          >
            <Route path="/os/nova" element={<CreateWorkOrderPage />} />
          </Route>
          <Route
            element={
              <PermissionRoute permission="core.registration_fields.read" />
            }
          >
            <Route
              path="/configuracoes/cadastro"
              element={<TenantRegistrationFieldsPage />}
            />
          </Route>
          <Route
            element={<PermissionRoute permission="core.module_menu.read" />}
          >
            <Route
              path="/configuracoes/menu"
              element={<TenantModuleMenuPage />}
            />
          </Route>
          <Route
            element={<PermissionRoute permission="rentals.schedule.read" />}
          >
            <Route path="/configuracoes/agenda" element={<SchedulePage />} />
          </Route>
          <Route
            element={<PermissionRoute permission="rentals.layouts.read" />}
          >
            <Route path="/configuracoes/layout" element={<RentalLayoutsPage />} />
          </Route>
          <Route
            element={
              <PermissionRoute permission="rentals.reservations.read" />
            }
          >
            <Route
              path="/configuracoes/reservas"
              element={<ReservationsPage />}
            />
          </Route>
          <Route
            element={<PermissionRoute permission="catalog.products.read" />}
          >
            <Route path="/catalogo/produtos" element={<CatalogProductsPage />} />
          </Route>
          <Route
            element={<PermissionRoute permission="catalog.orders.read" />}
          >
            <Route path="/catalogo/pedidos" element={<CatalogOrdersPage />} />
            <Route
              path="/catalogo/pedidos/:orderId"
              element={<CatalogOrderDetailPage />}
            />
          </Route>
          <Route
            element={
              <PermissionRoute permission="catalog.notifications.read" />
            }
          >
            <Route
              path="/catalogo/notificacoes"
              element={<CatalogNotificationsPage />}
            />
          </Route>
          <Route element={<PermissionRoute permission="core.users.read" />}>
            <Route path="/pessoas-e-acesso" element={<PeopleAccessPage />} />
          </Route>

          <Route element={<PlatformAdminRoute />}>
            <Route
              path="/admin"
              element={<Navigate to="/admin/dashboard" replace />}
            />
            <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
            <Route path="/admin/users" element={<AdminUsersPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
