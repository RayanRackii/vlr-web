import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  listTenantCustomers,
  listTenantMembers,
} from "@/features/users/services/usersService"
import { api } from "@/lib/api"
import i18n from "@/lib/i18n"

vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn(),
  },
  getAxiosErrorPayload: vi.fn(),
  isAxiosError: vi.fn(() => false),
  parseApiError: vi.fn((_payload: unknown, fallback: string) => fallback),
}))

const apiGet = vi.mocked(api.get)

describe("people directory responses", () => {
  beforeEach(() => {
    apiGet.mockReset()
  })

  it("rejects a null customer page instead of treating it as an empty list", async () => {
    apiGet.mockResolvedValue({ data: null })

    await expect(listTenantCustomers()).rejects.toThrow(
      i18n.t("users.errors.invalidResponse"),
    )
  })

  it("rejects a null team page instead of treating it as an empty list", async () => {
    apiGet.mockResolvedValue({ data: null })

    await expect(listTenantMembers()).rejects.toThrow(
      i18n.t("users.errors.invalidResponse"),
    )
  })

  it("parses a customer page without password, document, or phone fields", async () => {
    apiGet.mockResolvedValue({
      data: {
        items: [
          {
            id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
            name: "Cliente Portal",
            email: "cliente@example.com",
            emailVerified: false,
            createdAt: "2026-10-13T15:00:00.000Z",
          },
        ],
        page: 1,
        pageSize: 20,
        total: 1,
      },
    })

    const page = await listTenantCustomers({ q: "cl", page: 1, pageSize: 20 })

    expect(apiGet).toHaveBeenCalledWith("/api/customers", {
      params: { q: "cl", page: 1, pageSize: 20 },
    })
    expect(page.items[0]?.name).toBe("Cliente Portal")
    expect(page.items[0]).not.toHaveProperty("passwordHash")
    expect(page.items[0]).not.toHaveProperty("document")
    expect(page.items[0]).not.toHaveProperty("phone")
  })
})
