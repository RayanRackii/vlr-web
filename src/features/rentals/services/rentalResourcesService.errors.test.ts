import { beforeEach, describe, expect, it, vi } from "vitest"

import { api } from "@/lib/api"
import i18n from "@/lib/i18n"
import { updateRentalAsset } from "@/features/rentals/services/rentalResourcesService"

type FakeAxiosError = { isFake: true; response?: { status: number; data: unknown } }

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn() },
  isAxiosError: (e: unknown) => typeof e === "object" && e !== null && "isFake" in e,
  getAxiosErrorPayload: (e: FakeAxiosError) => e.response?.data ?? null,
  parseApiError: (payload: unknown, fallback: string) =>
    typeof payload === "object" && payload !== null && "error" in payload
      ? String((payload as { error: unknown }).error)
      : fallback,
}))

const body = {
  name: "Sala",
  unitId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  categoryId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  familyId: "11111111-1111-1111-1111-111111111101",
  rentalType: "Location" as const,
  totalQuantity: 1,
  requiresDeposit: false,
  queueEnabled: false,
  queueOpeningTime: null,
  location: "x",
}

async function failWith(error: FakeAxiosError): Promise<string> {
  vi.mocked(api.put).mockRejectedValueOnce(error)
  try {
    await updateRentalAsset("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", body)
    return "resolved"
  } catch (e) {
    return e instanceof Error ? e.message : "non-error"
  }
}

const kind = (k: string) => i18n.t(`rentals.resources.errorKinds.${k}`)

describe("updateRentalAsset error messages", () => {
  beforeEach(() => vi.mocked(api.put).mockReset())

  it("says there is no connection when no response arrived", async () => {
    expect(await failWith({ isFake: true })).toBe(kind("network"))
  })

  it.each([401, 403])("says permission for %i without detail", async (status) => {
    expect(await failWith({ isFake: true, response: { status, data: null } })).toBe(kind("permission"))
  })

  it.each([400, 422])("shows the server detail for %i", async (status) => {
    expect(await failWith({ isFake: true, response: { status, data: { error: "Localização muito longa" } } })).toBe("Localização muito longa")
  })

  it("says validation for 400 without detail", async () => {
    expect(await failWith({ isFake: true, response: { status: 400, data: "" } })).toBe(kind("validation"))
  })

  it("says server error for 5xx even with a payload", async () => {
    expect(await failWith({ isFake: true, response: { status: 503, data: { error: "boom" } } })).toBe(kind("server"))
  })

  it("falls back to the generic update error for other statuses", async () => {
    expect(await failWith({ isFake: true, response: { status: 409, data: null } })).toBe(
      i18n.t("rentals.resources.updateError"),
    )
  })

  it("has distinct strings in every locale", () => {
    for (const lng of ["pt-BR", "en", "es"]) {
      const msgs = ["network", "permission", "validation", "server"].map((k) =>
        i18n.t(`rentals.resources.errorKinds.${k}`, { lng }),
      )
      expect(new Set(msgs).size).toBe(4)
      msgs.forEach((m) => expect(m).not.toContain("errorKinds"))
    }
  })
})
