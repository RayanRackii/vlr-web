import { AxiosError, type InternalAxiosRequestConfig } from "axios"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { api, publicApi } from "@/lib/api"
import i18n from "@/lib/i18n"

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>()
  return {
    ...actual,
    api: {
      get: vi.fn(),
      put: vi.fn(),
    },
    publicApi: {
      get: vi.fn(),
    },
  }
})

import {
  fetchPublicBookingPolicy,
  getBookingPolicy,
  replaceBookingPolicy,
} from "@/features/rentals/services/bookingPolicyService"

const apiGet = vi.mocked(api.get)
const apiPut = vi.mocked(api.put)
const publicGet = vi.mocked(publicApi.get)

function axiosError(status: number, data: unknown): AxiosError {
  return new AxiosError("boom", undefined, undefined, undefined, {
    status,
    statusText: "Error",
    data,
    headers: {},
    config: { headers: {} } as InternalAxiosRequestConfig,
  })
}

describe("bookingPolicyService", () => {
  beforeEach(() => {
    apiGet.mockReset()
    apiPut.mockReset()
    publicGet.mockReset()
  })

  it("loads the admin policy", async () => {
    apiGet.mockResolvedValue({
      data: {
        cancellationPolicyText: "Bring a document.",
        maxActiveReservationsPerCustomerPerDay: 2,
      },
    })

    await expect(getBookingPolicy()).resolves.toEqual({
      cancellationPolicyText: "Bring a document.",
      maxActiveReservationsPerCustomerPerDay: 2,
    })
    expect(apiGet).toHaveBeenCalledWith("/api/rentals/booking-policy")
  })

  it("replaces both fields, including nulls", async () => {
    apiPut.mockResolvedValue({
      data: {
        cancellationPolicyText: null,
        maxActiveReservationsPerCustomerPerDay: null,
      },
    })

    await replaceBookingPolicy({
      cancellationPolicyText: null,
      maxActiveReservationsPerCustomerPerDay: null,
    })

    expect(apiPut).toHaveBeenCalledWith("/api/rentals/booking-policy", {
      cancellationPolicyText: null,
      maxActiveReservationsPerCustomerPerDay: null,
    })
    const body = apiPut.mock.calls[0]?.[1]
    expect(Object.keys(body as object).sort()).toEqual([
      "cancellationPolicyText",
      "maxActiveReservationsPerCustomerPerDay",
    ])
  })

  it("omits the horizon, sends null, or sends a number", async () => {
    apiPut.mockResolvedValue({
      data: {
        cancellationPolicyText: "Keep it.",
        maxActiveReservationsPerCustomerPerDay: 2,
        maxAdvanceBookingDays: 30,
      },
    })

    await replaceBookingPolicy({
      cancellationPolicyText: "Keep it.",
      maxActiveReservationsPerCustomerPerDay: 2,
    })
    expect(apiPut.mock.calls[0]?.[1]).not.toHaveProperty("maxAdvanceBookingDays")

    apiPut.mockResolvedValue({
      data: {
        cancellationPolicyText: "Keep it.",
        maxActiveReservationsPerCustomerPerDay: 2,
        maxAdvanceBookingDays: null,
      },
    })
    await expect(
      replaceBookingPolicy({
        cancellationPolicyText: "Keep it.",
        maxActiveReservationsPerCustomerPerDay: 2,
        maxAdvanceBookingDays: null,
      }),
    ).resolves.toMatchObject({ maxAdvanceBookingDays: null })
    expect(apiPut.mock.calls[1]?.[1]).toMatchObject({
      maxAdvanceBookingDays: null,
    })

    apiPut.mockResolvedValue({
      data: {
        cancellationPolicyText: "Keep it.",
        maxActiveReservationsPerCustomerPerDay: 2,
        maxAdvanceBookingDays: 14,
      },
    })
    await expect(
      replaceBookingPolicy({
        cancellationPolicyText: "Keep it.",
        maxActiveReservationsPerCustomerPerDay: 2,
        maxAdvanceBookingDays: 14,
      }),
    ).resolves.toMatchObject({ maxAdvanceBookingDays: 14 })
    expect(apiPut.mock.calls[2]?.[1]).toMatchObject({
      maxAdvanceBookingDays: 14,
    })
  })

  it("surfaces the API message when save is rejected", async () => {
    apiPut.mockRejectedValue(
      axiosError(400, {
        error:
          "Daily booking limit must be an integer from 1 to 100, or null for unlimited.",
      }),
    )

    await expect(
      replaceBookingPolicy({
        cancellationPolicyText: "ok",
        maxActiveReservationsPerCustomerPerDay: 2,
      }),
    ).rejects.toThrow(
      "Daily booking limit must be an integer from 1 to 100, or null for unlimited.",
    )
  })

  it("rejects an unexpected payload", async () => {
    apiGet.mockResolvedValue({ data: { unexpected: true } })

    await expect(getBookingPolicy()).rejects.toThrow(
      i18n.t("apiErrors.invalidPayload"),
    )
  })

  it("loads the anonymous public policy for a subdomain", async () => {
    publicGet.mockResolvedValue({
      data: {
        cancellationPolicyText: null,
        maxActiveReservationsPerCustomerPerDay: 4,
      },
    })

    await expect(fetchPublicBookingPolicy("ficc")).resolves.toEqual({
      cancellationPolicyText: null,
      maxActiveReservationsPerCustomerPerDay: 4,
    })
    expect(publicGet).toHaveBeenCalledWith(
      "/api/public/tenants/ficc/booking-policy",
    )
    expect(apiGet).not.toHaveBeenCalled()
  })
})


it.each([undefined, null, 0, 8760])("preserves cutoff presence in PUT: %s", async (hours) => {
  const base = { cancellationPolicyText: null, maxActiveReservationsPerCustomerPerDay: null }
  const policy = hours === undefined ? base : { ...base, cancelCutoffHours: hours }
  apiPut.mockResolvedValue({ data: policy })
  await expect(replaceBookingPolicy(policy)).resolves.toEqual(policy)
  expect(apiPut).toHaveBeenLastCalledWith("/api/rentals/booking-policy", policy)
})
