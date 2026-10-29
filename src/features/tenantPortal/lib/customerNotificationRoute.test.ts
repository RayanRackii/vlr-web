import { describe, expect, it } from "vitest"
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
