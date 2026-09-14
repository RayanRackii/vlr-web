import { beforeEach, describe, expect, it, vi } from "vitest"

import { api } from "@/lib/api"
import { resetCurrentUserCacheForTests } from "@/features/users/services/currentUserCache"
import { getCurrentUser } from "@/features/users/services/usersService"

vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn(),
  },
  getAxiosErrorPayload: vi.fn(),
  isAxiosError: vi.fn(() => false),
  parseApiError: vi.fn((_payload: unknown, fallback: string) => fallback),
}))

const apiGet = vi.mocked(api.get)

const payload = {
  id: "11111111-1111-4111-8111-111111111111",
  fullName: "Admin A",
  email: "admin-a@example.com",
  role: "ADMIN",
  tenantId: "22222222-2222-4222-8222-222222222222",
  activeModules: ["catalog"],
  activeAssetFamilies: [],
  isTrial: false,
  isTrialReadOnly: false,
  notificationsEmailOnly: false,
  roles: [],
  permissions: ["core.notifications.read"],
}

describe("getCurrentUser HTTP dedup", () => {
  beforeEach(() => {
    resetCurrentUserCacheForTests()
    apiGet.mockReset()
    apiGet.mockResolvedValue({ data: payload })
  })

  it("issues one GET /api/users/me for 7 concurrent callers", async () => {
    const profiles = await Promise.all(
      Array.from({ length: 7 }, () => getCurrentUser()),
    )

    expect(apiGet).toHaveBeenCalledTimes(1)
    expect(apiGet).toHaveBeenCalledWith("/api/users/me")
    expect(profiles.every((item) => item.email === payload.email)).toBe(true)
  })

  it("force refresh bypasses the session cache", async () => {
    await getCurrentUser()
    await getCurrentUser({ force: true })
    expect(apiGet).toHaveBeenCalledTimes(2)
  })
})
