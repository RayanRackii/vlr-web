import { describe, expect, it } from "vitest"

import { appNavigationItems, filterNavigationItemsByAccess } from "./navigation"
import { matchNavigationPath } from "./navigationMatching"

describe("navigation route matching", () => {
  it.each([
    ["/pmoc", "nav.pmoc", "nav.pmocPlans", undefined, false],
    ["/pmoc/plan-1", "nav.pmoc", "nav.pmocPlans", undefined, true],
    ["/pmoc/plan-1/tasks", "nav.pmoc", "nav.pmocPlans", undefined, true],
    ["/pmoc/novo", "nav.pmoc", "nav.pmocNew", "nav.pmocCustom", false],
    ["/pmoc/biblioteca/template-1", "nav.pmoc", "nav.pmocNew", "nav.pmocLibrary", true],
    ["/ativos", "nav.assets", undefined, "nav.assetsInventory", false],
    ["/ativos/asset-1", "nav.assets", undefined, "nav.assetsInventory", true],
    ["/ativos/categorias/", "nav.assets", undefined, "nav.assetsCategories", false],
    ["/configuracoes/politica-reservas", "nav.reservations", undefined, "nav.bookingPolicy", false],
    ["/configuracoes/cadastro", "nav.peopleAccess", undefined, "nav.registrationFields", false],
    ["/os/order-1", "nav.workOrders", undefined, undefined, true],
    ["/catalogo/pedidos/order-1", "nav.catalogOrders", undefined, undefined, true],
  ])("resolves %s to its most specific item", (path, item, child, tab, detail) => {
    const match = matchNavigationPath(appNavigationItems, path)
    expect(match?.item.labelKey).toBe(item)
    expect(match?.child?.labelKey).toBe(child)
    expect(match?.tab?.labelKey).toBe(tab)
    expect(match?.isDetail).toBe(detail)
  })

  it.each(["/ativosX", "/pmocX/plan-1", "/osX/order-1", "/catalogo/pedidosX"]) (
    "does not match the partial segment %s", (path) => {
      expect(matchNavigationPath(appNavigationItems, path)).toBeUndefined()
    },
  )

  it("matches a permitted tab when it is the parent's first available destination", () => {
    const items = filterNavigationItemsByAccess(appNavigationItems, ["inventory"], ["inventory.categories.read"])
    expect(matchNavigationPath(items, "/ativos/categorias")?.item.labelKey).toBe("nav.assets")
    expect(matchNavigationPath(items, "/ativos/private-asset")).toBeUndefined()
  })
})
