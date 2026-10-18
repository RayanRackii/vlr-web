import { AxiosError, type InternalAxiosRequestConfig } from "axios"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { api } from "@/lib/api"

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>()
  return {
    ...actual,
    api: {
      get: vi.fn(),
      post: vi.fn(),
    },
  }
})

import {
  PLATFORM_ADMIN_USES_ENTER,
  listMyStaffTenants,
  selectMyStaffTenant,
} from "@/features/users/services/staffTenantsService"

const get = vi.mocked(api.get)
const post = vi.mocked(api.post)

const tenantId = "22222222-2222-4222-8222-222222222222"
const otherTenantId = "33333333-3333-4333-8333-333333333333"

const list = {
  accessTokenTenantId: tenantId,
  authMetadataTenantId: tenantId,
  sessionRefreshRequired: false,
  memberships: [
    {
      tenantId,
      legalName: "Clube Norte Ltda",
      tradeName: "Clube Norte",
      subdomain: "norte",
    },
    {
      tenantId: otherTenantId,
      legalName: "Clube Sul Ltda",
      tradeName: null,
      subdomain: null,
    },
  ],
}

function apiError(status: number, code: string): AxiosError {
  return new AxiosError(code, undefined, undefined, undefined, {
    status,
    statusText: "Error",
    data: { error: code },
    headers: {},
    config: { headers: {} } as InternalAxiosRequestConfig,
  })
}

describe("staff tenant membership client", () => {
  beforeEach(() => {
    get.mockReset()
    post.mockReset()
  })

  it("lists active memberships", async () => {
    get.mockResolvedValue({ data: list })

    await expect(listMyStaffTenants()).resolves.toEqual(list)
    expect(get).toHaveBeenCalledWith("/api/users/me/tenants")
  })

  it("selects a tenant and returns the refresh flag", async () => {
    post.mockResolvedValue({
      data: {
        tenantId: otherTenantId,
        legalName: "Clube Sul Ltda",
        tradeName: null,
        subdomain: null,
        sessionRefreshRequired: true,
      },
    })

    await expect(selectMyStaffTenant(otherTenantId)).resolves.toMatchObject({
      tenantId: otherTenantId,
      sessionRefreshRequired: true,
    })
    expect(post).toHaveBeenCalledWith("/api/users/me/tenant", {
      tenantId: otherTenantId,
    })
  })

  it("maps 409 PLATFORM_ADMIN_USES_ENTER", async () => {
    get.mockRejectedValue(apiError(409, PLATFORM_ADMIN_USES_ENTER))

    await expect(listMyStaffTenants()).rejects.toMatchObject({
      name: "StaffTenantError",
      code: PLATFORM_ADMIN_USES_ENTER,
      status: 409,
    })
  })

  it("rejects a list body that does not match the contract", async () => {
    get.mockResolvedValue({ data: { memberships: [] } })

    await expect(listMyStaffTenants()).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
    })
  })
})
