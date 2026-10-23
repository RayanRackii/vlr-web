import { useMemo } from "react"
import { Navigate, Route, Routes, useLocation, useParams } from "react-router-dom"

import { DashboardHomeRoute } from "@/components/layout/DashboardHomeRoute"
import { RENTAL_RESOURCES_PERMISSIONS } from "@/components/layout/navigation"
import { MainLayout } from "@/components/layout/MainLayout"
import { PermissionRoute } from "@/components/layout/PermissionRoute"
import { PlatformAdminRoute } from "@/components/layout/PlatformAdminRoute"
import { ProtectedRoute } from "@/components/layout/ProtectedRoute"
import { adminManifest } from "@/features/admin/manifest"
import { authManifest } from "@/features/auth/manifest"
import { catalogManifest } from "@/features/catalog/manifest"
import { assetsManifest } from "@/features/assets/manifest"
import { landingManifest } from "@/features/landing/manifest"
import { dashboardManifest } from "@/features/dashboard/manifest"
import { notificationsManifest } from "@/features/notifications/manifest"
import { onboardingManifest } from "@/features/onboarding/manifest"
import { pmocManifest } from "@/features/pmoc/manifest"
import { ReservationsPage } from "@/features/rentals/pages/ReservationsPage"
import { BookingPolicyPage } from "@/features/rentals/pages/BookingPolicyPage"
import { RentalLayoutsPage } from "@/features/rentals/pages/RentalLayoutsPage"
import { RentalResourcesPage } from "@/features/rentals/pages/RentalResourcesPage"
import { SchedulePage } from "@/features/rentals/pages/SchedulePage"
import { CustomerAppLayout } from "@/features/tenantPortal/components/CustomerAppLayout"
import { TenantPortalLayout } from "@/features/tenantPortal/components/TenantPortalLayout"
import { tenantPortalManifest } from "@/features/tenantPortal/manifest"
import { taxonomyManifest } from "@/features/taxonomy/manifest"
import { getHostTenantSubdomain } from "@/features/tenantPortal/services/tenantPortalService"
import { usersManifest } from "@/features/users/manifest"
import { workOrdersManifest } from "@/features/workOrders/manifest"
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
      {landingManifest.routes.public.map((route) => <Route key={route.path} path={route.path} element={route.element} />)}
      {onboardingManifest.routes.public.map((route) => <Route key={route.path} path={route.path} element={route.element} />)}
      {authManifest.routes.public.map((route) => <Route key={route.path} path={route.path} element={route.element} />)}

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
          {adminManifest.routes.platformStandalone.map((route) => <Route key={route.path} path={route.path} element={route.element} />)}
        </Route>

        <Route element={<MainLayout />}>
          <Route element={<DashboardHomeRoute />}>
            {dashboardManifest.routes.staff.map((route) => (
              <Route key={route.path} path={route.path} element={route.element} />
            ))}
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
          {workOrdersManifest.routes.staff.map((route) => (
            <Route key={route.path} element={<PermissionRoute permission={route.permission} />}>
              <Route path={route.path} element={route.element} />
            </Route>
          ))}
          {adminManifest.routes.staff.map((route) => (
            <Route key={route.path} element={<PermissionRoute permission={route.permission} />}>
              <Route path={route.path} element={route.element} />
            </Route>
          ))}
          {taxonomyManifest.routes.staff.map((route) => (
            <Route key={route.path} element={<PermissionRoute permission={route.permission} />}>
              <Route path={route.path} element={route.element} />
            </Route>
          ))}
          {notificationsManifest.routes.staff.map((route) => (
            <Route key={route.path} element={<PermissionRoute permission={route.permission} />}>
              <Route path={route.path} element={route.element} />
            </Route>
          ))}
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
          {usersManifest.routes.staff.map((route) =>
            route.permission ? (
              <Route key={route.path} element={<PermissionRoute permission={route.permission} />}>
                <Route path={route.path} element={route.element} />
              </Route>
            ) : (
              <Route key={route.path} path={route.path} element={route.element} />
            ),
          )}

          <Route element={<PlatformAdminRoute />}>
            {adminManifest.routes.platformShell.map((route) => <Route key={route.path} path={route.path} element={route.element} />)}
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<UnknownPathRoute />} />
    </Routes>
  )
}
