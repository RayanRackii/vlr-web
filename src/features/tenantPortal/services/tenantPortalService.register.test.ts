import { AxiosError, type InternalAxiosRequestConfig } from "axios"
import { afterEach, describe, expect, it, vi } from "vitest"

import { publicApi } from "@/lib/api"
import { registerCustomer } from "@/features/tenantPortal/services/tenantPortalService"

function apiError(status: number, data: unknown): AxiosError {
  return new AxiosError("Request failed", undefined, undefined, undefined, {
    status,
    statusText: "Error",
    data,
    headers: {},
    config: { headers: {} } as InternalAxiosRequestConfig,
  })
}

const body = {
  name: "Ana Silva",
  email: "ana@club.test",
  password: "password1",
  phone: "11988880001",
  customerType: "Individual" as const,
  document: "52998224725",
}

describe("registerCustomer duplicate detection", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("throws a field-tagged error when the e-mail is the duplicate", async () => {
    vi.spyOn(publicApi, "post").mockRejectedValue(
      apiError(409, { error: "A customer with this email already exists." }),
    )

    await expect(registerCustomer("ficc", body)).rejects.toMatchObject({
      name: "CustomerDuplicateFieldError",
      field: "email",
      message: "Já existe uma conta com este e-mail.",
    })
  })

  it("throws a field-tagged error when the document is the duplicate", async () => {
    vi.spyOn(publicApi, "post").mockRejectedValue(
      apiError(409, {
        error: "A customer with this document already exists.",
      }),
    )

    await expect(registerCustomer("ficc", body)).rejects.toMatchObject({
      name: "CustomerDuplicateFieldError",
      field: "document",
    })
  })

  it("falls back to a plain error when the backend cannot name a single field", async () => {
    vi.spyOn(publicApi, "post").mockRejectedValue(
      apiError(409, {
        error:
          "A customer with the same email, document, or phone already exists.",
      }),
    )

    const failure = await registerCustomer("ficc", body).catch(
      (error: unknown) => error,
    )
    expect(failure).toBeInstanceOf(Error)
    expect(failure).not.toMatchObject({ name: "CustomerDuplicateFieldError" })
    expect((failure as Error).message).toBe("Já existe uma conta com estes dados.")
  })
})
