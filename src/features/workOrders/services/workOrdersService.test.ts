import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from "axios"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { api } from "@/lib/api"
import i18n from "@/lib/i18n"
import { PLAN_ID } from "@/features/pmoc/test/pmocFixtures"
import { makeWorkOrder, matchingRegistryAsset } from "@/features/workOrders/test/workOrderFixtures"

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>()
  return {
    ...actual,
    api: {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
    },
  }
})

import {
  generateWorkOrderFromPlan,
  getWorkOrders,
  isDuplicateWorkOrderError,
  listWorkOrderAssets,
} from "@/features/workOrders/services/workOrdersService"

const apiGet = vi.mocked(api.get)
const apiPost = vi.mocked(api.post)

function axiosError(status: number, data: unknown): AxiosError {
  const error = new AxiosError("Request failed")
  error.response = {
    status,
    data,
    statusText: status === 409 ? "Conflict" : "Error",
    headers: {},
    config: { headers: {} } as InternalAxiosRequestConfig,
  } as AxiosResponse
  return error
}

describe("workOrdersService registry assets", () => {
  beforeEach(() => {
    apiGet.mockReset()
    apiPost.mockReset()
    apiGet.mockResolvedValue({ data: [matchingRegistryAsset] })
  })

  it("lists picker assets from GET /api/work-orders/assets, not /api/assets", async () => {
    const result = await listWorkOrderAssets()

    expect(apiGet).toHaveBeenCalledWith("/api/work-orders/assets")
    expect(apiGet).not.toHaveBeenCalledWith("/api/assets")
    expect(result).toEqual([matchingRegistryAsset])
  })
})

describe("workOrdersService plan generation", () => {
  beforeEach(() => {
    apiGet.mockReset()
    apiPost.mockReset()
  })

  it("lists work orders by maintenancePlanId without dropping assetId", async () => {
    apiGet.mockResolvedValue({ data: [makeWorkOrder()] })

    await getWorkOrders({ maintenancePlanId: PLAN_ID })

    expect(apiGet).toHaveBeenCalledWith("/api/work-orders", {
      params: { maintenancePlanId: PLAN_ID },
    })
  })

  it("keeps the existing assetId list filter", async () => {
    apiGet.mockResolvedValue({ data: [makeWorkOrder()] })

    await getWorkOrders({ assetId: matchingRegistryAsset.id })

    expect(apiGet).toHaveBeenCalledWith("/api/work-orders", {
      params: { assetId: matchingRegistryAsset.id },
    })
  })

  it("posts generate from plan to POST /api/work-orders/from-plan", async () => {
    const created = makeWorkOrder()
    apiPost.mockResolvedValue({ data: created })

    const result = await generateWorkOrderFromPlan({
      planId: PLAN_ID,
      assetId: matchingRegistryAsset.id,
      assignedUserId: null,
      scheduledDate: "2026-09-18",
    })

    expect(apiPost).toHaveBeenCalledWith("/api/work-orders/from-plan", {
      planId: PLAN_ID,
      assetId: matchingRegistryAsset.id,
      assignedUserId: null,
      scheduledDate: "2026-09-18",
    })
    expect(result.sourcePlanName).toBe("PMOC Split Mensal")
  })

  it("maps 409 DUPLICATE_WORK_ORDER without falling back to a generic error", async () => {
    apiPost.mockRejectedValue(
      axiosError(409, {
        error: "A work order already exists for this plan, asset and period.",
        code: "DUPLICATE_WORK_ORDER",
      }),
    )

    try {
      await generateWorkOrderFromPlan({
        planId: PLAN_ID,
        assetId: matchingRegistryAsset.id,
        assignedUserId: null,
        scheduledDate: "2026-09-18",
      })
      throw new Error("expected DUPLICATE_WORK_ORDER")
    } catch (error: unknown) {
      expect(isDuplicateWorkOrderError(error)).toBe(true)
      expect((error as Error).message).toBe(
        i18n.t("pmoc.plans.generate.errors.duplicate"),
      )
      expect((error as Error).message).not.toMatch(/^Erro$/i)
    }
  })
})
