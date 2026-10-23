import { describe, expect, it } from "vitest"

import appRoutesSource from "@/routes/AppRoutes.tsx?raw"
import navigationSource from "@/components/layout/navigation.ts?raw"
import { appNavigationItems } from "@/components/layout/navigation"
import { catalogManifest } from "@/features/catalog/manifest"
import { tenantPortalManifest } from "@/features/tenantPortal/manifest"
import { assetsManifest } from "@/features/assets/manifest"
import { pmocManifest } from "@/features/pmoc/manifest"

describe("feature manifests", () => {
  it("keeps tenant portal and catalog routes in their manifests", () => {
    expect(tenantPortalManifest.routes.public.map((route) => route.path)).toEqual([
      undefined,
      "register",
      "verify-email",
      "verify-phone",
      "forgot-password",
      "forgot-password/confirm",
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
})
