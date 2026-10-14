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

import { requestPasswordReset } from "@/features/auth/passwordRecoveryService"

const post = vi.mocked(publicApi.post)

const genericMessage = i18n.t("auth.login.resetSent")

function apiError(status: number, message: string): AxiosError {
  return new AxiosError(message, undefined, undefined, undefined, {
    status,
    statusText: "Error",
    data: { error: message },
    headers: {},
    config: { headers: {} } as InternalAxiosRequestConfig,
  })
}

describe("requestPasswordReset", () => {
  beforeEach(() => {
    post.mockReset()
  })

  it("posts the staff forgot-password route with the current tenant subdomain", async () => {
    post.mockResolvedValue({
      data: { message: genericMessage },
    })

    const message = await requestPasswordReset("Ana@club.test", "Ficc")

    expect(post).toHaveBeenCalledWith(
      "/api/auth/forgot-password",
      { email: "Ana@club.test" },
      { headers: { "X-Tenant-Subdomain": "ficc" } },
    )
    expect(message).toBe(genericMessage)
  })

  it("returns the same generic sentence when the API body is empty", async () => {
    post.mockResolvedValue({ data: {} })

    await expect(requestPasswordReset("missing@club.test", "ficc")).resolves.toBe(
      genericMessage,
    )
  })

  it("omits the tenant header when the current page has no tenant and still returns the generic sentence", async () => {
    post.mockResolvedValue({
      data: { message: genericMessage },
    })

    const message = await requestPasswordReset("ana@club.test", null)

    expect(post).toHaveBeenCalledWith("/api/auth/forgot-password", {
      email: "ana@club.test",
    })
    expect(message).toBe(genericMessage)
  })

  it("omits a blank tenant header", async () => {
    post.mockResolvedValue({ data: { message: genericMessage } })

    await requestPasswordReset("ana@club.test", "   ")

    expect(post).toHaveBeenCalledWith("/api/auth/forgot-password", {
      email: "ana@club.test",
    })
  })

  it("throws the API error and does not return the generic success sentence", async () => {
    post.mockRejectedValue(apiError(400, "Email is required."))

    await expect(requestPasswordReset("  ", "ficc")).rejects.toThrow(
      "Email is required.",
    )
  })
})
