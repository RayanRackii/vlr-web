import { AxiosError, type InternalAxiosRequestConfig } from "axios"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { customerApi } from "@/lib/api"
import {
  createAttemptKey,
  idempotencyKeyErrorMessage,
  retryWhileInProgress,
} from "@/lib/idempotency"
import i18n from "@/lib/i18n"

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>()
  return { ...actual, customerApi: { get: vi.fn(), post: vi.fn() } }
})

import { createPortalCatalogOrder } from "@/features/catalog/services/catalogPortalService"
import { createPortalReservation } from "@/features/tenantPortal/services/tenantPortalService"

const customerPost = vi.mocked(customerApi.post)

function apiError(status: number, code: string, headers: Record<string, string> = {}) {
  return new AxiosError("fail", "ERR", undefined, undefined, {
    status,
    statusText: "",
    data: { error: "x", code },
    headers,
    config: { headers: {} } as InternalAxiosRequestConfig,
  })
}

describe("createAttemptKey", () => {
  it("keeps the key for the same content, changes it for new content and after reset", () => {
    const attempt = createAttemptKey()
    const first = attempt.keyFor("a")
    expect(attempt.keyFor("a")).toBe(first)
    const second = attempt.keyFor("b")
    expect(second).not.toBe(first)
    attempt.reset()
    expect(attempt.keyFor("b")).not.toBe(second)
  })
})

describe("retryWhileInProgress", () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it("retries after Retry-After on idempotency.in_progress and returns the result", async () => {
    const send = vi
      .fn()
      .mockRejectedValueOnce(apiError(409, "idempotency.in_progress", { "retry-after": "1" }))
      .mockResolvedValueOnce("ok")
    const result = retryWhileInProgress(send)
    await vi.advanceTimersByTimeAsync(999)
    expect(send).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    await expect(result).resolves.toBe("ok")
    expect(send).toHaveBeenCalledTimes(2)
  })

  it("gives up after two retries and does not retry other errors", async () => {
    const stuck = vi.fn().mockRejectedValue(apiError(409, "idempotency.in_progress"))
    const result = retryWhileInProgress(stuck)
    const assertion = expect(result).rejects.toBeDefined()
    await vi.advanceTimersByTimeAsync(5000)
    await assertion
    expect(stuck).toHaveBeenCalledTimes(3)

    const other = vi.fn().mockRejectedValue(apiError(409, "idempotency.key_reused"))
    await expect(retryWhileInProgress(other)).rejects.toBeDefined()
    expect(other).toHaveBeenCalledTimes(1)
  })
})

describe("idempotency in the services", () => {
  beforeEach(() => {
    customerPost.mockReset()
  })

  it("sends the Idempotency-Key header on order and reservation creation", async () => {
    customerPost.mockResolvedValue({ data: {} })
    await createPortalCatalogOrder({ items: [] }, { idempotencyKey: "key-1" }).catch(() => undefined)
    expect(customerPost).toHaveBeenCalledWith(
      "/api/catalog/portal/orders",
      { items: [] },
      { headers: { "Idempotency-Key": "key-1" } },
    )
    await createPortalReservation(
      { unitId: "u", date: "2026-09-08", startTime: "10:00", endTime: "11:00", items: [] },
      { idempotencyKey: "key-2" },
    ).catch(() => undefined)
    expect(customerPost).toHaveBeenLastCalledWith(
      "/api/reservations",
      expect.objectContaining({ unitId: "u" }),
      { headers: { "Idempotency-Key": "key-2" } },
    )
  })

  it("maps key_reused to the generic localized message", async () => {
    customerPost.mockRejectedValue(apiError(409, "idempotency.key_reused"))
    await expect(createPortalCatalogOrder({ items: [] }, { idempotencyKey: "k" })).rejects.toThrow(
      i18n.t("apiErrors.idempotencyKey"),
    )
    await expect(
      createPortalReservation(
        { unitId: "u", date: "d", startTime: "s", endTime: "e", items: [] },
        { idempotencyKey: "k" },
      ),
    ).rejects.toThrow(i18n.t("apiErrors.idempotencyKey"))
    expect(idempotencyKeyErrorMessage(apiError(400, "idempotency.key_invalid"))).toBe(
      i18n.t("apiErrors.idempotencyKey"),
    )
    expect(idempotencyKeyErrorMessage(apiError(400, "other"))).toBeNull()
  })
})
