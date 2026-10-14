import { AxiosError, type InternalAxiosRequestConfig } from "axios"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { publicApi } from "@/lib/api"
import i18n from "@/lib/i18n"

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>()
  return {
    ...actual,
    publicApi: {
      post: vi.fn(),
    },
  }
})

import { createTenant } from "@/features/onboarding/createTenant"
import type { CreateTenantRequest } from "@/features/onboarding/createTenantSchema"

const post = vi.mocked(publicApi.post)

const request: CreateTenantRequest = {
  legalName: "Clube",
  taxId: "123",
  tradeName: "",
  headquartersUnitName: "Matriz",
  headquartersUnitCode: "",
  adminFullName: "Ana",
  adminEmail: "ana@clube.com",
  adminPhone: "11999999999",
  isTrial: true,
}

const created = {
  tenantId: "11111111-1111-4111-8111-111111111111",
  headquartersUnitId: "22222222-2222-4222-8222-222222222222",
  adminUserId: null,
  superAdminRoleId: "33333333-3333-4333-8333-333333333333",
  supabaseAuthId: null,
  inviteId: "44444444-4444-4444-8444-444444444444",
  subdomain: "club",
}

function apiError(status: number, message: string): AxiosError {
  return new AxiosError(message, undefined, undefined, undefined, {
    status,
    statusText: "Error",
    data: { error: message },
    headers: {},
    config: { headers: {} } as InternalAxiosRequestConfig,
  })
}

describe("createTenant", () => {
  beforeEach(() => {
    post.mockReset()
  })

  it("posts a passwordless trial and accepts null auth ids", async () => {
    post.mockResolvedValue({ data: created })

    await expect(
      createTenant({
        ...request,
        adminPassword: "secret-password",
      } as CreateTenantRequest),
    ).resolves.toEqual(created)

    expect(post).toHaveBeenCalledWith("/api/onboarding/tenants", {
      legalName: "Clube",
      taxId: "123",
      tradeName: null,
      headquartersUnitName: "Matriz",
      headquartersUnitCode: null,
      adminFullName: "Ana",
      adminEmail: "ana@clube.com",
      adminPhone: "11999999999",
      isTrial: true,
    })
    const body = post.mock.calls[0]?.[1]
    expect(body).not.toHaveProperty("adminPassword")
  })

  it("maps trial and signup failures to friendly copy", async () => {
    const cases = [
      [429, "ANONYMOUS_TRIAL_RATE_LIMITED", "trial.onboarding.errors.rateLimited"],
      [409, "SIGNUP_REJECTED", "trial.onboarding.errors.signupRejected"],
      [502, "SIGNUP_UNAVAILABLE", "trial.onboarding.errors.signupUnavailable"],
      [400, "ANONYMOUS_TRIAL_REQUIRED", "trial.onboarding.errors.trialRequired"],
      [
        409,
        "Trial already used for this email or phone.",
        "trial.onboarding.errors.trialAlreadyUsed",
      ],
    ] as const

    for (const [status, apiMessage, key] of cases) {
      post.mockRejectedValueOnce(apiError(status, apiMessage))
      await expect(createTenant(request)).rejects.toThrow(i18n.t(key))
    }
  })

  it("hides an unexpected API sentence", async () => {
    post.mockRejectedValue(apiError(400, "AdminPassword is not accepted."))

    await expect(createTenant(request)).rejects.toThrow(
      i18n.t("trial.onboarding.errors.failed"),
    )
  })
})
