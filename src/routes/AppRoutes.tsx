import { useMemo } from "react"
import { Navigate, Route, Routes, useLocation, useParams } from "react-router-dom"

import { DashboardHomeRoute } from "@/components/layout/DashboardHomeRoute"
import { RENTAL_RESOURCES_PERMISSIONS } from "@/components/layout/navigation"
import { MainLayout } from "@/components/layout/MainLayout"
import { PermissionRoute } from "@/components/layout/PermissionRoute"
import { PlatformAdminRoute } from "@/components/layout/PlatformAdminRoute"
import { ProtectedRoute } from "@/components/layout/ProtectedRoute"
import { AdminAssetFamiliesPage } from "@/features/admin/pages/AdminAssetFamiliesPage"
import { AdminDashboardPage } from "@/features/admin/pages/AdminDashboardPage"
import { AdminUsersPage } from "@/features/admin/pages/AdminUsersPage"
import { catalogManifest } from "@/features/catalog/manifest"
import { EditTenantPage } from "@/features/admin/pages/EditTenantPage"
import { NewTenantPage } from "@/features/admin/pages/NewTenantPage"
import { TenantModuleMenuPage } from "@/features/admin/pages/TenantModuleMenuPage"
import { TenantRegistrationFieldsPage } from "@/features/admin/pages/TenantRegistrationFieldsPage"
import { ResourceVisualCatalogPage } from "@/features/admin/pages/ResourceVisualCatalogPage"
import { LoginPage } from "@/features/auth/LoginPage"
import { ResetPasswordPage } from "@/features/auth/ResetPasswordPage"
import { SetPasswordPage } from "@/features/auth/SetPasswordPage"
import { assetsManifest } from "@/features/assets/manifest"
import { DashboardPage } from "@/features/dashboard/pages/DashboardPage"
import { LandingPage } from "@/features/landing/pages/LandingPage"
import { OnboardingPage } from "@/features/onboarding/OnboardingPage"
import { pmocManifest } from "@/features/pmoc/manifest"
import { ReservationsPage } from "@/features/rentals/pages/ReservationsPage"
import { BookingPolicyPage } from "@/features/rentals/pages/BookingPolicyPage"
import { RentalLayoutsPage } from "@/features/rentals/pages/RentalLayoutsPage"
import { RentalResourcesPage } from "@/features/rentals/pages/RentalResourcesPage"
import { SchedulePage } from "@/features/rentals/pages/SchedulePage"
import { CustomerAppLayout } from "@/features/tenantPortal/components/CustomerAppLayout"
import { TenantPortalLayout } from "@/features/tenantPortal/components/TenantPortalLayout"
import { tenantPortalManifest } from "@/features/tenantPortal/manifest"
import { NotificationsSettingsPage } from "@/features/notifications/pages/NotificationsSettingsPage"
import { TaxonomyPage } from "@/features/taxonomy/pages/TaxonomyPage"
import { getHostTenantSubdomain } from "@/features/tenantPortal/services/tenantPortalService"
import { WorkOrderExecutionPage } from "@/features/workOrders/pages/WorkOrderExecutionPage"
import { CreateWorkOrderPage } from "@/features/workOrders/pages/CreateWorkOrderPage"
import { WorkOrdersPage } from "@/features/workOrders/pages/WorkOrdersPage"
import { PeopleAccessPage } from "@/features/users/pages/PeopleAccessPage"
import { StaffProfilePage } from "@/features/users/pages/StaffProfilePage"
import { UnknownPathRoute } from "@/routes/UnknownPathRoute"

function RedirectVerifyPhoneToEmail() {
  const location = useLocation()
  return (
    <Navigate
      to="../verify-email"
      relative="path"
      replace
      state={location.state}
    />
  )
}

function RedirectTenantStaffRoute() {
  const location = useLocation()
  const { subdomain } = useParams<{ subdomain: string }>()
  const prefix = `/t/${subdomain ?? ""}`
  const rootPath = location.pathname.startsWith(prefix)
    ? location.pathname.slice(prefix.length) || "/dashboard"
    : "/dashboard"
  return <Navigate to={`${rootPath}${location.search}`} replace />
}

export function AppRoutes() {
  const hostSubdomain = useMemo(() => getHostTenantSubdomain(), [])

  // Host mode: ficc.rolvix.com.br → portal branded (sem landing).
  if (hostSubdomain) {
    return (
      <Routes>
        <Route element={<TenantPortalLayout />}>
          {tenantPortalManifest.routes.public.map((route) =>
            route.redirectToEmail ? (
              <Route key={route.path} path={route.path} element={<RedirectVerifyPhoneToEmail />} />
            ) : (
              <Route key={route.path ?? "index"} index={route.path === undefined} path={route.path} element={route.element} />
            ),
          )}
        </Route>
        <Route element={<CustomerAppLayout />}>
          {[...tenantPortalManifest.routes.customer, ...catalogManifest.routes.customer].map((route) => <Route key={route.path} path={route.path} element={route.element} />)}
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
        <Route path="configuracoes/*" element={<RedirectTenantStaffRoute />} />
        <Route path="dashboard/*" element={<RedirectTenantStaffRoute />} />
        <Route path="ativos/*" element={<RedirectTenantStaffRoute />} />
        <Route path="pmoc/*" element={<RedirectTenantStaffRoute />} />
        <Route path="os/*" element={<RedirectTenantStaffRoute />} />
        <Route path="pessoas-e-acesso/*" element={<RedirectTenantStaffRoute />} />
        <Route path="perfil/*" element={<RedirectTenantStaffRoute />} />
        <Route path="catalogo/configuracoes/*" element={<RedirectTenantStaffRoute />} />
        <Route element={<TenantPortalLayout />}>
          {tenantPortalManifest.routes.public.map((route) =>
            route.redirectToEmail ? (
              <Route key={route.path} path={route.path} element={<RedirectVerifyPhoneToEmail />} />
            ) : (
              <Route key={route.path ?? "index"} index={route.path === undefined} path={route.path} element={route.element} />
            ),
          )}
        </Route>
        <Route element={<CustomerAppLayout />}>
          {[...tenantPortalManifest.routes.customer, ...catalogManifest.routes.customer].map((route) => <Route key={route.path} path={route.path} element={route.element} />)}
        </Route>
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<PlatformAdminRoute />}>
          <Route
            path="/admin/tenants"
            element={<Navigate to="/admin/dashboard" replace />}
          />
          <Route path="/admin/tenants/new" element={<NewTenantPage />} />
          <Route path="/admin/tenants/:id/edit" element={<EditTenantPage />} />
        </Route>

        <Route element={<MainLayout />}>
          <Route element={<DashboardHomeRoute />}>
            <Route path="/dashboard" element={<DashboardPage />} />
          </Route>
          {assetsManifest.routes.staff.map((route) => (
            <Route key={route.path} element={<PermissionRoute permission={route.permission} />}>
              <Route path={route.path} element={route.element} />
            </Route>
          ))}
          {pmocManifest.routes.staff.map((route) => (
            <Route key={route.path} element={<PermissionRoute permission={route.permission} />}>
              <Route path={route.path} element={route.element} />
            </Route>
          ))}
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
            element={
              <PermissionRoute permission="core.notifications.read" />
            }
          >
            <Route
              path="/configuracoes/notificacoes"
              element={<NotificationsSettingsPage />}
            />
          </Route>
          <Route element={<PermissionRoute permission="core.taxonomy.read" />}>
            <Route path="/configuracoes/categorias-tags" element={<TaxonomyPage />} />
          </Route>
          <Route
            element={
              <PermissionRoute permissions={RENTAL_RESOURCES_PERMISSIONS} />
            }
          >
            <Route
              path="/configuracoes/recursos"
              element={<RentalResourcesPage />}
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
            element={
              <PermissionRoute permission="rentals.booking_policy.read" />
            }
          >
            <Route
              path="/configuracoes/politica-reservas"
              element={<BookingPolicyPage />}
            />
          </Route>
          {catalogManifest.routes.staff.map((route) => (
            <Route key={route.path} element={<PermissionRoute permission={route.permission} />}>
              <Route path={route.path} element={route.element} />
            </Route>
          ))}
          <Route element={<PermissionRoute permission="core.users.read" />}>
            <Route path="/pessoas-e-acesso" element={<PeopleAccessPage />} />
          </Route>
          <Route path="/perfil" element={<StaffProfilePage />} />

          <Route element={<PlatformAdminRoute />}>
            <Route
              path="/admin"
              element={<Navigate to="/admin/dashboard" replace />}
            />
            <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
            <Route path="/admin/users" element={<AdminUsersPage />} />
            <Route path="/admin/recursos-visuais" element={<ResourceVisualCatalogPage />} />
            <Route path="/admin/tenants/:id/recursos-visuais" element={<ResourceVisualCatalogPage />} />
            <Route
              path="/admin/asset-families"
              element={<AdminAssetFamiliesPage />}
            />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<UnknownPathRoute />} />
    </Routes>
  )
}
