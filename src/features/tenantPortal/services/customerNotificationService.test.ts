import { afterEach, describe, expect, it, vi } from "vitest"
import { AxiosHeaders, type AxiosAdapter } from "axios"
import i18n from "@/lib/i18n"
import { customerApi } from "@/lib/api"
import { clearCustomerSession, persistCustomerSession } from "./tenantPortalService"
import { getNotificationSummary, listNotifications, markIdsRead, markAllRead } from "./customerNotificationService"

const originalAdapter = customerApi.defaults.adapter

afterEach(() => {
  customerApi.defaults.adapter = originalAdapter
  clearCustomerSession()
  vi.restoreAllMocks()
})

describe("customer notification service", () => {
  it("fetches the customer summary using the customer portal bearer token", async () => {
    persistCustomerSession("customer-test-token", "shop")
    const adapter = vi.fn<AxiosAdapter>(async (config) => ({
      config, status: 200, statusText: "OK", headers: new AxiosHeaders(),
      data: { unreadTotal: 2, groups: [] },
    }))
    customerApi.defaults.adapter = adapter
    await expect(getNotificationSummary()).resolves.toEqual({ unreadTotal: 2, groups: [] })
    const config = adapter.mock.calls[0][0]
    expect(config.url).toBe("/api/me/customer-notifications/summary")
    expect(config.headers.get("Authorization")).toBe("Bearer customer-test-token")
  })
})

describe("customer notification operations", () => {
  it("lists with pagination and marks individual IDs and all unread using the customer token", async () => {
    persistCustomerSession("customer-test-token", "shop")
    const adapter = vi.fn<AxiosAdapter>(async (config) => ({
      config, status: 200, statusText: "OK", headers: new AxiosHeaders(),
      data: config.method === "get" ? { items: [], nextCursor: null } : { updated: 1 },
    }))
    customerApi.defaults.adapter = adapter
    const controller = new AbortController()
    await expect(listNotifications({ cursor: "next", unreadOnly: true, limit: 7 }, controller.signal))
      .resolves.toEqual({ items: [], nextCursor: null })
    await expect(markIdsRead(["id-1", "id-2"])).resolves.toEqual({ updated: 2 })
    await expect(markAllRead()).resolves.toEqual({ updated: 1 })
    expect(adapter.mock.calls.map(([config]) => [config.method, config.url])).toEqual([
      ["get", "/api/me/customer-notifications"],
      ["post", "/api/me/customer-notifications/id-1/read"],
      ["post", "/api/me/customer-notifications/id-2/read"],
      ["post", "/api/me/customer-notifications/read-all"],
    ])
    expect(adapter.mock.calls[0][0].params).toEqual({ cursor: "next", unreadOnly: true, limit: 7 })
    expect(adapter.mock.calls[0][0].signal).toBe(controller.signal)
    for (const [config] of adapter.mock.calls) {
      expect(config.headers.get("Authorization")).toBe("Bearer customer-test-token")
    }
  })

  it("rejects invalid API payloads", async () => {
    customerApi.defaults.adapter = async (config) => ({
      config, status: 200, statusText: "OK", headers: new AxiosHeaders(), data: {},
    })
    await expect(getNotificationSummary()).rejects.toThrow(i18n.t("apiErrors.invalidResponse"))
    await expect(listNotifications()).rejects.toThrow(i18n.t("apiErrors.invalidResponse"))
    await expect(markIdsRead(["id-1"])).rejects.toThrow(i18n.t("apiErrors.invalidResponse"))
    await expect(markAllRead()).rejects.toThrow(i18n.t("apiErrors.invalidResponse"))
  })
})
