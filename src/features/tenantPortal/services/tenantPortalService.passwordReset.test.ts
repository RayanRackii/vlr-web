import { beforeEach, describe, expect, it, vi } from "vitest"

import { publicApi } from "@/lib/api"

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>()
  return {
    ...actual,
    publicApi: {
      post: vi.fn(),
    },
  }
})

import { requestCustomerPasswordReset } from "@/features/tenantPortal/services/tenantPortalService"

const post = vi.mocked(publicApi.post)

describe("requestCustomerPasswordReset", () => {
  beforeEach(() => {
    post.mockReset()
    post.mockResolvedValue({ data: {} })
  })

  it("posts the portal forgot-password route with the current tenant subdomain", async () => {
    await requestCustomerPasswordReset("ficc", { email: "ana@club.test" })

    expect(post).toHaveBeenCalledWith(
      "/api/auth/customer/password-reset/request",
      { email: "ana@club.test" },
      { headers: { "X-Tenant-Subdomain": "ficc" } },
    )
  })
})
