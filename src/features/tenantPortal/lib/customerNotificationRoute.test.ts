import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { sanitizeCustomerNotificationRoute } from "./customerNotificationRoute"


describe("sanitizeCustomerNotificationRoute", () => {
  it.each([
    "/t/shop/pedidos/order-1",
    "/t/shop/pedidos",
  ])("preserves a current-tenant destination %j", (route) => {
    expect(sanitizeCustomerNotificationRoute(route, "shop")).toBe(route)
  })

  it.each([
    "/t/other/app",
    "/catalogo/pedidos/1",
    "/\n/evil.test/x",
    "https://evil.test",
    "//evil.test",
    "/t/shop/../other",
    "/t/shop/pedidos/../app",
    "/t/shop-other/pedidos/1",
    "/t/shop",
    "",
    "pedidos/1",
    "javascript:alert(1)",
    "https://portal.test/t/shop/pedidos/1",
    "/\\evil.test/x",
    "/t/shop/pedidos\\1",
    "/t/shop/pedidos/a b",
    "/t/shop/pedidos/1\t",
    "/t/shop/pedidos/1\r",
    "/t/shop/pedidos/\u0000",
    "/t/shop/pedidos/\u007f",
    "/t/shop/pedidos/\u0085",
    "/t/shop/pedidos/\u00a0",
    "/t/shop/%2e%2e/other",
    "/t/shop/pedidos/%2e./app",
    "/t/shop/%2e%2e%2fother",
    "/t/shop/pedidos/%0a",
    "/t/shop/pedidos/%5c",
    "/t/shop/pedidos/%zz",
  ])("falls back to this tenant's orders for %j", (route) => {
    expect(sanitizeCustomerNotificationRoute(route, "shop")).toBe("/t/shop/pedidos")
  })

  it("uses the supplied current tenant rather than a tenant from the destination", () => {
    expect(sanitizeCustomerNotificationRoute("/t/shop/pedidos/1", "club")).toBe("/t/club/pedidos")
    expect(sanitizeCustomerNotificationRoute("/t/club/pedidos/1", "club")).toBe("/t/club/pedidos/1")
  })
})

describe("sanitizeCustomerNotificationRoute allowlist", () => {
  it.each([
    "/t/shop/?returnTo=%2Ft%2Fother%2Fapp",
    "/t/shop/register?returnTo=/t/other/app",
    "/t/shop/configuracoes/usuarios?company=other",
    "/t/shop/dashboard",
    "/t/shop/pedidos/1?returnTo=/t/other",
    "/t/shopx/pedidos/1",
    "/t/SHOP/pedidos/1",
  ])("falls back for %s", (route) => {
    expect(sanitizeCustomerNotificationRoute(route, "shop")).toBe("/t/shop/pedidos")
  })
  it("keeps the order detail", () => {
    expect(sanitizeCustomerNotificationRoute("/t/shop/pedidos/abc-123", "shop")).toBe("/t/shop/pedidos/abc-123")
  })
})


describe.each([
  { mode: "path", hostname: "localhost", orders: "/t/shop/pedidos" },
  { mode: "host", hostname: "shop.rolvix.com.br", orders: "/pedidos" },
])("customer notification destinations in $mode mode", ({ hostname, orders }) => {
  beforeEach(() => vi.stubGlobal("window", { location: { hostname } }))
  afterEach(() => vi.unstubAllGlobals())

  it.each([
    ["/t/shop/pedidos", ""],
    ["/pedidos", ""],
    ["/t/shop/pedidos/order-1", "/order-1"],
    ["/pedidos/order-1", "/order-1"],
  ])("maps %s to the active portal mode", (route, suffix) => {
    expect(sanitizeCustomerNotificationRoute(route, "shop")).toBe(`${orders}${suffix}`)
  })


  it.each([
    "",
    "/t/other/pedidos/order-1",
    "/t/shopx/pedidos/order-1",
    "/t/SHOP/pedidos/order-1",
    "/t/shop/dashboard",
    "/dashboard",
    "/catalogo/pedidos/order-1",
    "https://evil.test/pedidos/order-1",
    "https://shop.rolvix.com.br/pedidos/order-1",
    "//evil.test/pedidos/order-1",
    "javascript:alert(1)",
    "/t/shop/pedidos/order-1?returnTo=/dashboard",
    "/t/shop/pedidos/order-1#details",
    "/pedidos/order-1?returnTo=/t/other/app",
    "/pedidos/order-1#details",
    "/t/shop/pedidos/../app",
    "/pedidos/../dashboard",
    "/pedidos/%2e%2e/dashboard",
    "/pedidos/%2e%2e%2fdashboard",
    "/pedidos/%5c",
    "/pedidos/%0a",
    "/pedidos/with space",
    "/pedidos/order-1\n",
    "/pedidos/order-1\r",
    "/pedidos/order-1\t",
    "/pedidos/\u0000",
    "/pedidos/order-1/details",
    "/pedidos/" + "a".repeat(65),
  ])("uses the active-mode fallback for rejected destination %j", (route) => {
    expect(sanitizeCustomerNotificationRoute(route, "shop")).toBe(orders)
  })
})
