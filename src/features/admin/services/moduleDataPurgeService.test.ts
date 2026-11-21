import { AxiosError, type AxiosResponse } from "axios"
import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  cancelModuleDataPurge,
  getModuleDataPurgePreview,
  ModuleDataPurgeError,
  scheduleModuleDataPurge,
} from "@/features/admin/services/moduleDataPurgeService"
import { api } from "@/lib/api"
import i18n from "@/lib/i18n"

function axiosFailure(status: number, data: unknown): AxiosError {
  return new AxiosError("fail", String(status), undefined, undefined, {
    status,
    data,
  } as AxiosResponse)
}

describe("moduleDataPurgeService", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("pt-BR")
    vi.restoreAllMocks()
  })

  it("reads the preview tolerantly (missing optional fields, extra fields)", async () => {
    vi.spyOn(api, "get").mockResolvedValue({
      data: { module: "rentals", tables: [{ table: "a.b", rows: 2 }], extra: true },
    })
    const result = await getModuleDataPurgePreview("t1", "rentals")
    expect(result.tables).toEqual([{ table: "a.b", rows: 2 }])
    expect(result.blockers).toEqual([])
    expect(result.storageObjects).toBe(0)
    expect(result.pending ?? null).toBeNull()
  })

  it("maps confirm.mismatch to a localized message with the code", async () => {
    vi.spyOn(api, "post").mockRejectedValue(
      axiosFailure(400, { error: "x", code: "confirm.mismatch" }),
    )
    await expect(scheduleModuleDataPurge("t1", "rentals", "no")).rejects.toMatchObject({
      code: "confirm.mismatch",
      message: "A confirmação não confere com o módulo.",
    })
  })

  it("returns the blocking preview on a 409 with blockers", async () => {
    vi.spyOn(api, "post").mockRejectedValue(
      axiosFailure(409, {
        module: "rentals",
        tables: [],
        blockers: [{ code: "module.active" }],
      }),
    )
    const error = await scheduleModuleDataPurge("t1", "rentals", "rentals").catch(
      (e: unknown) => e,
    )
    expect(error).toBeInstanceOf(ModuleDataPurgeError)
    expect((error as ModuleDataPurgeError).preview?.blockers[0]?.code).toBe("module.active")
  })

  it("maps already pending and reason too long", async () => {
    vi.spyOn(api, "post").mockRejectedValue(
      axiosFailure(409, { error: "x", code: "purge.already_pending" }),
    )
    await expect(scheduleModuleDataPurge("t1", "rentals", "rentals")).rejects.toMatchObject({
      code: "purge.already_pending",
    })
    vi.spyOn(api, "delete").mockRejectedValue(
      axiosFailure(400, { error: "x", code: "reason.too_long" }),
    )
    await expect(cancelModuleDataPurge("t1", "rentals", "r")).rejects.toMatchObject({
      code: "reason.too_long",
    })
  })

  it("sends the trimmed reason as a query param and omits it when empty", async () => {
    const del = vi.spyOn(api, "delete").mockResolvedValue({ data: null })
    await cancelModuleDataPurge("t1", "rentals", "  motivo ")
    expect(del).toHaveBeenLastCalledWith(
      "/api/admin/tenants/t1/modules/rentals/data-purge",
      { params: { reason: "motivo" } },
    )
    await cancelModuleDataPurge("t1", "rentals", "  ")
    expect(del).toHaveBeenLastCalledWith(
      "/api/admin/tenants/t1/modules/rentals/data-purge",
      { params: undefined },
    )
  })
})
