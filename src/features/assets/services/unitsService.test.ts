import { beforeEach, describe, expect, it, vi } from "vitest"

import { api, isAxiosError } from "@/lib/api"
import i18n from "@/lib/i18n"

vi.mock("@/lib/api", () => ({
  api: { get: vi.fn(), post: vi.fn() },
  isAxiosError: vi.fn(),
}))

const UNIT = {
  id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  tenantId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
  name: "Sede",
  code: null,
  isActive: true,
}

describe("createUnit", () => {
  beforeEach(() => {
    vi.mocked(api.post).mockReset()
    vi.mocked(isAxiosError).mockReset()
  })

  it("posts the compact request and validates the created unit", async () => {
    vi.mocked(api.post).mockResolvedValue({ data: UNIT })
    const { createUnit } = await import("@/features/assets/services/unitsService")

    await expect(createUnit({ name: " Sede " })).resolves.toEqual(UNIT)
    expect(api.post).toHaveBeenCalledWith("/api/units", { name: "Sede" })
  })

  it("turns a duplicate response into a friendly message", async () => {
    vi.mocked(isAxiosError).mockReturnValue(true)
    vi.mocked(api.post).mockRejectedValue({ response: { status: 409 } })
    const { createUnit } = await import("@/features/assets/services/unitsService")

    await expect(createUnit({ name: "Sede" })).rejects.toThrow(
      i18n.t("rentals.resources.inlineCreate.unitDuplicate"),
    )
  })
})
