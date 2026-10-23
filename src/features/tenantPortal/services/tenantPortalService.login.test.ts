import { AxiosError, type InternalAxiosRequestConfig } from "axios"
import { afterEach, describe, expect, it, vi } from "vitest"

import { publicApi } from "@/lib/api"
import {
  clearCustomerSession,
  loginCustomer,
} from "@/features/tenantPortal/services/tenantPortalService"

function apiError(
  status: number,
  data: unknown,
  headers: Record<string, string> = {},
): AxiosError {
  return new AxiosError("Request failed", undefined, undefined, undefined, {
    status,
    statusText: "Error",
    data,
    headers,
    config: { headers: {} } as InternalAxiosRequestConfig,
  })
}

describe("loginCustomer", () => {
  afterEach(() => {
    vi.restoreAllMocks()
    clearCustomerSession()
  })

  it("preserves Retry-After on a 429 response", async () => {
    vi.spyOn(publicApi, "post").mockRejectedValue(
      apiError(429, { error: "Too many login attempts." }, { "retry-after": "61" }),
    )

    await expect(
      loginCustomer("ficc", { email: "ana@club.test", password: "wrong-password" }),
    ).rejects.toMatchObject({
      name: "CustomerLoginRateLimitedError",
      retryAfterSeconds: 61,
    })
  })

  it("preserves a 429 response without Retry-After as rate-limited", async () => {
    vi.spyOn(publicApi, "post").mockRejectedValue(
      apiError(429, { error: "Too many login attempts." }),
    )

    await expect(
      loginCustomer("ficc", { email: "ana@club.test", password: "wrong-password" }),
    ).rejects.toMatchObject({
      name: "CustomerLoginRateLimitedError",
      retryAfterSeconds: null,
    })
  })

  it("keeps the existing invalid-credentials error for a 401 response", async () => {
    vi.spyOn(publicApi, "post").mockRejectedValue(
      apiError(401, { error: "Invalid email or password." }),
    )

    await expect(
      loginCustomer("ficc", { email: "ana@club.test", password: "wrong-password" }),
    ).rejects.toThrow("E-mail ou senha inválidos.")
  })
})
