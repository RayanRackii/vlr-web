import { beforeEach, describe, expect, it, vi } from "vitest"

import { api, publicApi } from "@/lib/api"
import { bookingIdleRedirectTarget } from "@/features/tenantPortal/lib/bookingIdleSettings"
import { bookingIdleRedirectPathSchema, bookingIdleTimeoutMinutesSchema } from "@/features/tenantPortal/schemas/bookingIdleSettingsSchema"
import { fetchTenantMenu, updateModuleMenuItem } from "./tenantPortalService"

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>()
  return { ...actual, api: { put: vi.fn() }, publicApi: { get: vi.fn() } }
})

const item = {
  id: "11111111-1111-4111-8111-111111111111",
  moduleName: "rentals", label: "Space", sortOrder: 0, isActive: true,
  bookingIdleTimeoutMinutes: 3, bookingIdleRedirectPath: "/agenda",
}

describe("portal menu idle settings", () => {
  beforeEach(() => vi.clearAllMocks())

  it("preserves the fields returned in the public menu", async () => {
    vi.mocked(publicApi.get).mockResolvedValue({ data: [item] })
    expect(await fetchTenantMenu("tenant")).toEqual([item])
  })

  it.each([
    { bookingIdleTimeoutMinutes: 120, bookingIdleRedirectPath: "/app" },
    { bookingIdleTimeoutMinutes: null, bookingIdleRedirectPath: null },
  ])("sends configured or inherited settings through the admin update ($bookingIdleTimeoutMinutes)", async (settings) => {
    const body = { label: item.label, sortOrder: 0, isActive: true, ...settings }
    vi.mocked(api.put).mockResolvedValue({ data: { ...item, ...settings } })
    const result = await updateModuleMenuItem(item.id, body, "tenant-id")
    expect(api.put).toHaveBeenCalledWith(`/api/admin/tenants/tenant-id/module-menu-items/${item.id}`, body)
    expect(result).toMatchObject(settings)
  })

  it("accepts the boundaries and rejects invalid settings", () => {
    for (const minutes of [1, 120]) expect(bookingIdleTimeoutMinutesSchema.safeParse(minutes).success).toBe(true)
    for (const minutes of [0, 121, 1.5, NaN]) expect(bookingIdleTimeoutMinutesSchema.safeParse(minutes).success).toBe(false)
    for (const path of ["/", "/agenda", "/app?tab=spaces#top"]) expect(bookingIdleRedirectPathSchema.safeParse(path).success).toBe(true)
    for (const path of ["", "agenda", "https://example.com", "//example.com", "/\\example.com", "/app\n"]) expect(bookingIdleRedirectPathSchema.safeParse(path).success).toBe(false)
  })

  it("scopes redirects to the current portal and defaults to its home", () => {
    expect(bookingIdleRedirectTarget("tenant", null)).toBe("/t/tenant/app")
    expect(bookingIdleRedirectTarget("tenant", "/agenda?view=spaces#top")).toBe("/t/tenant/agenda?view=spaces#top")
    expect(bookingIdleRedirectTarget("tenant", "/t/tenant/agenda")).toBe("/t/tenant/agenda")
    expect(bookingIdleRedirectTarget("tenant", "/../app")).toBe("/t/tenant/app")
    expect(bookingIdleRedirectTarget("tenant", "/%2e%2e//example.com")).toBe("/t/tenant/example.com")
    expect(bookingIdleRedirectTarget("tenant", "//example.com")).toBe("/t/tenant/app")
  })
})
