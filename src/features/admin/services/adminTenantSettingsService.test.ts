import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  BOOKING_UI_ENABLED_KEY,
  getAdminTenantBooleanSetting,
  parseBooleanSetting,
  putAdminTenantBooleanSetting,
} from "@/features/admin/services/adminTenantSettingsService"
import { api } from "@/lib/api"

vi.mock("@/lib/api", () => ({
  api: { get: vi.fn(), put: vi.fn() },
  getAxiosErrorPayload: vi.fn(),
  parseApiError: vi.fn((_payload: unknown, fallback: string) => fallback),
}))

const TENANT = "3ae86b53-d43e-42b0-9616-4833d02f7a1e"

describe("adminTenantSettingsService", () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset()
    vi.mocked(api.put).mockReset()
  })

  it("parses booleans and treats a missing value as false", () => {
    expect(parseBooleanSetting("true")).toBe(true)
    expect(parseBooleanSetting(" TRUE ")).toBe(true)
    expect(parseBooleanSetting("false")).toBe(false)
    expect(parseBooleanSetting(null)).toBe(false)
    expect(parseBooleanSetting(undefined)).toBe(false)
  })

  it("reads the setting from the admin endpoint with an encoded key", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: { key: BOOKING_UI_ENABLED_KEY, value: "true" },
    })

    await expect(
      getAdminTenantBooleanSetting(TENANT, BOOKING_UI_ENABLED_KEY),
    ).resolves.toBe(true)
    expect(api.get).toHaveBeenCalledWith(
      `/api/admin/tenants/${TENANT}/settings/rentals.booking_ui.enabled`,
    )
  })

  it("writes the boolean as a string and returns the stored value", async () => {
    vi.mocked(api.put).mockResolvedValue({
      data: { key: BOOKING_UI_ENABLED_KEY, value: "false" },
    })

    await expect(
      putAdminTenantBooleanSetting(TENANT, BOOKING_UI_ENABLED_KEY, false),
    ).resolves.toBe(false)
    expect(api.put).toHaveBeenCalledWith(
      `/api/admin/tenants/${TENANT}/settings/rentals.booking_ui.enabled`,
      { value: "false" },
    )
  })

  it("throws a localized error when the request fails", async () => {
    vi.mocked(api.put).mockRejectedValue(new Error("boom"))

    await expect(
      putAdminTenantBooleanSetting(TENANT, BOOKING_UI_ENABLED_KEY, true),
    ).rejects.toThrow()
  })
})
