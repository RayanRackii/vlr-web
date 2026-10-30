import { AxiosError, type InternalAxiosRequestConfig } from "axios"
import { afterEach, describe, expect, it, vi } from "vitest"

import { publicApi } from "@/lib/api"
import {
  clearCustomerSession,
  getCustomerLabel,
  loginCustomer,
  verifyCustomerEmail,
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

  it.each([
    ["  Ana Silva  ", "ana@example.test", "Ana Silva"],
    ["   ", "ana@example.test", "ana@example.test"],
    ["Ana Silva", null, "Ana Silva"],
  ])("uses the profile name with email fallback for login and verification (%s)", async (name, email, expected) => {
    vi.spyOn(publicApi, "post").mockResolvedValue({ data: {
      token: "customer-token",
      customer: {
        id: "11111111-1111-4111-8111-111111111111",
        tenantId: "22222222-2222-4222-8222-222222222222",
        name,
        email,
        phone: null,
        photoUrl: null,
        createdAt: "2026-10-29T12:00:00.000Z",
        phoneVerified: false,
        emailVerified: true,
      },
    } })

    await loginCustomer("portal", { email: "ana@example.test", password: "password" })
    expect(getCustomerLabel()).toBe(expected)
    clearCustomerSession()
    await verifyCustomerEmail("portal", { email: "ana@example.test", code: "123456" })
    expect(getCustomerLabel()).toBe(expected)
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
