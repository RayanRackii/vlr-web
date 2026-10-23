import { describe, expect, it } from "vitest"

import appRoutesSource from "@/routes/AppRoutes.tsx?raw"
import { pmocManifest } from "@/features/pmoc/manifest"

describe("AppRoutes PMOC static paths", () => {
  it("declares static PMOC routes before /pmoc/:id", () => {
    const paths = pmocManifest.routes.staff.map((route) => route.path)

    expect(paths).toEqual([
      "/pmoc",
      "/pmoc/biblioteca",
      "/pmoc/biblioteca/:templateId",
      "/pmoc/novo",
      "/pmoc/:id",
    ])

    expect(paths.indexOf("/pmoc/biblioteca")).toBeLessThan(
      paths.indexOf("/pmoc/:id"),
    )
    expect(paths.indexOf("/pmoc/biblioteca/:templateId")).toBeLessThan(
      paths.indexOf("/pmoc/:id"),
    )
    expect(paths.indexOf("/pmoc/novo")).toBeLessThan(paths.indexOf("/pmoc/:id"))
  })

  it("R: /pmoc/:id remains gated by pmoc.plans.read", () => {
    expect(pmocManifest.routes.staff.find((route) => route.path === "/pmoc/:id")?.permission).toBe("pmoc.plans.read")
    expect(appRoutesSource).toContain("pmocManifest.routes.staff")
  })

  it("redirects staff paths accidentally opened below a tenant path back to root", () => {
    for (const prefix of [
      "configuracoes",
      "dashboard",
      "ativos",
      "pmoc",
      "os",
      "pessoas-e-acesso",
      "perfil",
      "catalogo/configuracoes",
    ]) {
      expect(appRoutesSource).toContain(
        `path="${prefix}/*" element={<RedirectTenantStaffRoute />}`,
      )
    }
  })
})
