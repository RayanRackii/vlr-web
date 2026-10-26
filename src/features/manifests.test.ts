import { describe, expect, it } from "vitest"

import appRoutesSource from "@/routes/AppRoutes.tsx?raw"
import navigationSource from "@/components/layout/navigation.ts?raw"
import { appNavigationItems } from "@/components/layout/navigation"
import { catalogManifest } from "@/features/catalog/manifest"
import { tenantPortalManifest } from "@/features/tenantPortal/manifest"
import { assetsManifest } from "@/features/assets/manifest"
import { pmocManifest } from "@/features/pmoc/manifest"
import { rentalsManifest } from "@/features/rentals/manifest"
import { taxonomyManifest } from "@/features/taxonomy/manifest"
import { notificationsManifest } from "@/features/notifications/manifest"
import { adminManifest } from "@/features/admin/manifest"
import { authManifest } from "@/features/auth/manifest"
import { landingManifest } from "@/features/landing/manifest"
import { onboardingManifest } from "@/features/onboarding/manifest"
import { dashboardManifest } from "@/features/dashboard/manifest"
import { usersManifest } from "@/features/users/manifest"
import { workOrdersManifest } from "@/features/workOrders/manifest"

describe("feature manifests", () => {
  it("keeps tenant portal and catalog routes in their manifests", () => {
    expect(tenantPortalManifest.routes.public.map((route) => route.path)).toEqual([
      undefined,
      "login",
      "register",
      "verify-email",
      "verify-phone",
      "forgot-password",
      "forgot-password/confirm",
      "reset-password",
    ])
    expect(tenantPortalManifest.routes.customer.map((route) => route.path)).toEqual([
      "app",
      "app/perfil",
      "agenda",
      "agenda/:menuItemId",
    ])
    expect(catalogManifest.routes.customer.map((route) => route.path)).toEqual([
      "catalogo",
      "catalogo/carrinho",
      "catalogo/solicitar",
      "catalogo/solicitacoes",
      "catalogo/solicitacoes/:requestId",
      "catalogo/:productId",
      "pedidos",
      "pedidos/:orderId",
    ])
    expect(catalogManifest.routes.staff.map((route) => route.path)).toEqual([
      "/catalogo/configuracoes",
      "/catalogo/produtos",
      "/catalogo/pedidos",
      "/catalogo/pedidos/:orderId",
      "/catalogo/notificacoes",
    ])

    expect(appRoutesSource).toContain("tenantPortalManifest.routes.public")
    expect(appRoutesSource).toContain("tenantPortalManifest.routes.customer")
    expect(appRoutesSource).toContain("catalogManifest.routes.customer")
    expect(appRoutesSource).toContain("catalogManifest.routes.staff")
  })

  it("uses the catalog navigation item exported by its manifest", () => {
    expect(catalogManifest.modules).toEqual(["catalog"])
    expect(catalogManifest.navigationItems).toHaveLength(1)
    expect(appNavigationItems).toContain(catalogManifest.navigationItems[0])
    expect(navigationSource).toContain("...catalogManifest.navigationItems")
    expect(tenantPortalManifest.navigationItems).toEqual([])
  })

  it("keeps assets and PMOC routes and navigation in their manifests", () => {
    expect(assetsManifest.modules).toEqual(["inventory"])
    expect(assetsManifest.routes.staff.map((route) => route.path)).toEqual([
      "/ativos",
      "/ativos/categorias",
    ])
    expect(pmocManifest.modules).toEqual(["pmoc"])
    expect(pmocManifest.routes.staff.map((route) => route.path)).toEqual([
      "/pmoc",
      "/pmoc/biblioteca",
      "/pmoc/biblioteca/:templateId",
      "/pmoc/novo",
      "/pmoc/:id",
    ])

    expect(appNavigationItems).toContain(assetsManifest.navigationItems[0])
    expect(appNavigationItems).toContain(pmocManifest.navigationItems[0])
    expect(navigationSource).toContain("...assetsManifest.navigationItems")
    expect(navigationSource).toContain("...pmocManifest.navigationItems")
    expect(appRoutesSource).toContain("assetsManifest.routes.staff")
    expect(appRoutesSource).toContain("pmocManifest.routes.staff")
  })

  it("keeps taxonomy and notifications routes and navigation in their manifests", () => {
    expect(taxonomyManifest.modules).toEqual([])
    expect(taxonomyManifest.routes.staff.map((route) => route.path)).toEqual([
      "/configuracoes/categorias-tags",
    ])
    expect(notificationsManifest.modules).toEqual(["catalog", "rentals"])
    expect(notificationsManifest.routes.staff.map((route) => route.path)).toEqual([
      "/configuracoes/notificacoes",
    ])

    expect(appNavigationItems).toContain(taxonomyManifest.navigationItems[0])
    expect(appNavigationItems).toContain(notificationsManifest.navigationItems[0])
    expect(navigationSource).toContain("...taxonomyManifest.navigationItems")
    expect(navigationSource).toContain("...notificationsManifest.navigationItems")
    expect(appRoutesSource).toContain("taxonomyManifest.routes.staff")
    expect(appRoutesSource).toContain("notificationsManifest.routes.staff")
  })

  it("keeps admin routes and platform navigation in its manifest", () => {
    expect(adminManifest.routes.platformStandalone.map((route) => route.path)).toEqual([
      "/admin/tenants",
      "/admin/tenants/new",
      "/admin/tenants/:id/edit",
    ])
    expect(adminManifest.routes.staff.map((route) => route.path)).toEqual([
      "/configuracoes/cadastro",
      "/configuracoes/menu",
    ])
    expect(adminManifest.routes.platformShell.map((route) => route.path)).toEqual([
      "/admin",
      "/admin/dashboard",
      "/admin/users",
      "/admin/recursos-visuais",
      "/admin/tenants/:id/recursos-visuais",
      "/admin/asset-families",
    ])
    expect(navigationSource).toContain("items: adminManifest.navigationItems")
    expect(appRoutesSource).toContain("adminManifest.routes.platformStandalone")
    expect(appRoutesSource).toContain("adminManifest.routes.staff")
    expect(appRoutesSource).toContain("adminManifest.routes.platformShell")
  })

  it("keeps public landing, onboarding, and auth routes in their manifests", () => {
    expect(landingManifest.routes.public.map((route) => route.path)).toEqual(["/", "/landing"])
    expect(onboardingManifest.routes.public.map((route) => route.path)).toEqual(["/onboarding"])
    expect(authManifest.routes.public.map((route) => route.path)).toEqual([
      "/login",
      "/forgot-password",
      "/reset-password",
      "/invite",
    ])
    expect(appRoutesSource).toContain("landingManifest.routes.public")
    expect(appRoutesSource).toContain("onboardingManifest.routes.public")
    expect(appRoutesSource).toContain("authManifest.routes.public")
  })

  it("keeps dashboard, users and work orders routes and navigation in their manifests", () => {
    expect(dashboardManifest.modules).toEqual([])
    expect(dashboardManifest.routes.staff.map((route) => route.path)).toEqual([
      "/dashboard",
    ])
    expect(usersManifest.modules).toEqual([])
    expect(usersManifest.routes.staff.map((route) => route.path)).toEqual([
      "/pessoas-e-acesso",
      "/perfil",
    ])
    expect(workOrdersManifest.modules).toEqual(["os"])
    expect(workOrdersManifest.routes.staff.map((route) => route.path)).toEqual([
      "/os",
      "/os/:id",
      "/os/nova",
    ])

    expect(appNavigationItems).toContain(dashboardManifest.navigationItems[0])
    expect(appNavigationItems).toContain(usersManifest.navigationItems[0])
    expect(appNavigationItems).toContain(workOrdersManifest.navigationItems[0])
    expect(navigationSource).toContain("dashboardManifest.navigationItems[0]")
    expect(navigationSource).toContain("...usersManifest.navigationItems")
    expect(navigationSource).toContain("...workOrdersManifest.navigationItems")
    expect(appRoutesSource).toContain("dashboardManifest.routes.staff")
    expect(appRoutesSource).toContain("usersManifest.routes.staff")
    expect(appRoutesSource).toContain("workOrdersManifest.routes.staff")
  })

  it("keeps rentals routes and navigation in its manifest", () => {
    expect(rentalsManifest.modules).toEqual(["rentals"])
    expect(rentalsManifest.routes.staff.map((route) => route.path)).toEqual([
      "/configuracoes/recursos",
      "/configuracoes/agenda",
      "/configuracoes/layout",
      "/configuracoes/reservas",
      "/configuracoes/politica-reservas",
    ])

    expect(appNavigationItems).toEqual(
      expect.arrayContaining(rentalsManifest.navigationItems),
    )
    expect(navigationSource).toContain("...rentalsManifest.navigationItems")
    expect(appRoutesSource).toContain("rentalsManifest.routes.staff")
    expect(appRoutesSource).not.toContain("features/rentals/pages")
  })

  it("has a manifest for every feature that owns routes", () => {
    const manifestsByFeature = {
      admin: adminManifest,
      assets: assetsManifest,
      auth: authManifest,
      catalog: catalogManifest,
      dashboard: dashboardManifest,
      landing: landingManifest,
      notifications: notificationsManifest,
      onboarding: onboardingManifest,
      pmoc: pmocManifest,
      rentals: rentalsManifest,
      taxonomy: taxonomyManifest,
      tenantPortal: tenantPortalManifest,
      users: usersManifest,
      workOrders: workOrdersManifest,
    }

    expect(Object.keys(manifestsByFeature)).toEqual([
      "admin",
      "assets",
      "auth",
      "catalog",
      "dashboard",
      "landing",
      "notifications",
      "onboarding",
      "pmoc",
      "rentals",
      "taxonomy",
      "tenantPortal",
      "users",
      "workOrders",
    ])
    for (const manifest of Object.values(manifestsByFeature)) {
      expect(
        (Object.values(manifest.routes) as readonly (readonly unknown[])[]).some(
          (routes) => routes.length > 0,
        ),
      ).toBe(true)
    }
  })
})
