import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from "axios"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const syncStore = new Map<string, unknown>()

vi.mock("idb-keyval", () => ({
  get: vi.fn(async (key: string) => syncStore.get(key)),
  set: vi.fn(async (key: string, value: unknown) => {
    syncStore.set(key, value)
  }),
  setMany: vi.fn(async (entries: ReadonlyArray<readonly [string, unknown]>) => {
    for (const [key, value] of entries) {
      syncStore.set(key, value)
    }
  }),
}))

import { api } from "@/lib/api"
import i18n from "@/lib/i18n"
import {
  listQueuedTaskIds,
  listSyncConflicts,
  processSyncQueue,
} from "@/lib/offlineSync"
import { PLAN_ID } from "@/features/pmoc/test/pmocFixtures"
import {
  makeWorkOrder,
  matchingRegistryAsset,
  sampleTechnician,
  TECHNICIAN_ID,
  WORK_ORDER_ID,
} from "@/features/workOrders/test/workOrderFixtures"

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
  getWorkOrderById,
  getWorkOrders,
  isDuplicateWorkOrderError,
  listWorkOrderAssets,
  updateTaskValue,
  updateWorkOrderAssignee,
  updateWorkOrderStatus,
} from "@/features/workOrders/services/workOrdersService"

const apiGet = vi.mocked(api.get)
const apiPost = vi.mocked(api.post)
const apiPut = vi.mocked(api.put)
const apiPatch = vi.mocked(api.patch)

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

  it("localizes an ineligible asset without the raw id", async () => {
    apiPost.mockRejectedValue(
      axiosError(400, {
        error: `Asset '${matchingRegistryAsset.id}' is not eligible for this maintenance plan.`,
      }),
    )

    await expect(
      generateWorkOrderFromPlan({
        planId: PLAN_ID,
        assetId: matchingRegistryAsset.id,
        assignedUserId: null,
        scheduledDate: "2026-09-18",
      }),
    ).rejects.toThrow(i18n.t("workOrders.errors.assetNotEligible"))
  })

  it("translates Maintenance plan is not active.", async () => {
    apiPost.mockRejectedValue(
      axiosError(400, { error: "Maintenance plan is not active." }),
    )

    await expect(
      generateWorkOrderFromPlan({
        planId: PLAN_ID,
        assetId: matchingRegistryAsset.id,
        assignedUserId: null,
        scheduledDate: "2026-09-18",
      }),
    ).rejects.toThrow(i18n.t("pmoc.plans.generate.errors.planInactive"))
  })
})

describe("updateWorkOrderStatus offline", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("mentions the connection when start is attempted offline", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false)

    await expect(
      updateWorkOrderStatus(makeWorkOrder().id, "InProgress"),
    ).rejects.toThrow(i18n.t("workOrders.offline.startFailed"))
  })
})

describe("updateTaskValue online errors", () => {
  beforeEach(() => {
    syncStore.clear()
    apiPatch.mockReset()
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("localizes INVALID_TASK_VALUE from the reason field", async () => {
    const order = makeWorkOrder()
    const task = order.tasks[0]
    if (!task) {
      throw new Error("missing task")
    }
    apiPatch.mockRejectedValue(
      axiosError(400, {
        error: "Number values must be a decimal number.",
        code: "INVALID_TASK_VALUE",
        reason: "NOT_A_NUMBER",
      }),
    )

    await expect(updateTaskValue(order.id, task.id, "abc")).rejects.toThrow(
      i18n.t("workOrders.errors.taskValue.notANumber"),
    )
  })

  it("returns the parsed work order when the task patch body is valid", async () => {
    const order = makeWorkOrder()
    const task = order.tasks[0]
    if (!task) {
      throw new Error("missing task")
    }
    const saved = makeWorkOrder({
      tasks: [{ ...task, value: "true" }],
    })
    apiPatch.mockResolvedValue({ data: saved })

    await expect(
      updateTaskValue(order.id, task.id, "true"),
    ).resolves.toMatchObject({
      id: order.id,
      tasks: [expect.objectContaining({ id: task.id, value: "true" })],
    })
    expect(await listQueuedTaskIds()).toEqual([])
  })

  it("drops the queued value when a 200 body fails Zod and still throws invalidResponse", async () => {
    const order = makeWorkOrder()
    const task = order.tasks[0]
    if (!task) {
      throw new Error("missing task")
    }
    syncStore.set("os_sync_conflicts", [
      {
        id: `${order.id}:${task.id}`,
        workOrderId: order.id,
        taskId: task.id,
        value: "old",
        queuedAt: "2026-10-17T02:00:00.000Z",
        clientSequence: 1,
        status: 409,
        message: "Rejected",
        code: "WORK_ORDER_CLOSED",
        reason: null,
      },
    ])
    apiPatch.mockResolvedValue({ data: { unexpected: true } })

    await expect(updateTaskValue(order.id, task.id, "true")).rejects.toThrow(
      i18n.t("workOrders.errors.invalidResponse"),
    )

    expect(apiPatch).toHaveBeenCalledTimes(1)
    expect(await listQueuedTaskIds()).toEqual([])
    expect(await listSyncConflicts()).toEqual([])

    const flushed = await processSyncQueue()
    expect(flushed.processed).toBe(0)
    expect(apiPatch).toHaveBeenCalledTimes(1)
  })
})

describe("updateWorkOrderStatus mandatory tasks", () => {
  beforeEach(() => {
    apiPatch.mockReset()
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("includes the task titles from MANDATORY_TASKS_INCOMPLETE", async () => {
    apiPatch.mockRejectedValue(
      axiosError(400, {
        error: "Mandatory tasks are incomplete.",
        code: "MANDATORY_TASKS_INCOMPLETE",
        tasks: [
          {
            id: "16161616-1616-4161-8161-161616161616",
            title: "Verificar filtros",
          },
          {
            id: "17171717-1717-4171-8171-171717171717",
            title: "Pressão",
          },
        ],
      }),
    )

    await expect(
      updateWorkOrderStatus(makeWorkOrder().id, "Completed"),
    ).rejects.toThrow(
      i18n.t("workOrders.errors.mandatoryTasksIncompleteList", {
        tasks: "Verificar filtros, Pressão",
      }),
    )
  })
})

describe("work order read denial", () => {
  beforeEach(() => {
    apiGet.mockReset()
  })

  it("maps 404 and 403 to the assigned-or-forbidden message", async () => {
    apiGet.mockRejectedValueOnce(axiosError(404, ""))
    await expect(getWorkOrderById(WORK_ORDER_ID)).rejects.toThrow(
      i18n.t("workOrders.errors.notAssignedOrForbidden"),
    )

    apiGet.mockRejectedValueOnce(axiosError(403, { error: "FORBIDDEN" }))
    await expect(getWorkOrders()).rejects.toThrow(
      i18n.t("workOrders.errors.notAssignedOrForbidden"),
    )
  })
})

describe("updateWorkOrderAssignee", () => {
  beforeEach(() => {
    apiPut.mockReset()
  })

  it("puts the assignee on PUT /api/work-orders/{id}/assignee", async () => {
    const updated = makeWorkOrder({
      assignedUserId: TECHNICIAN_ID,
      assignedUser: sampleTechnician,
    })
    apiPut.mockResolvedValue({ data: updated })

    const result = await updateWorkOrderAssignee(WORK_ORDER_ID, TECHNICIAN_ID)

    expect(apiPut).toHaveBeenCalledWith(
      `/api/work-orders/${WORK_ORDER_ID}/assignee`,
      { assignedUserId: TECHNICIAN_ID },
    )
    expect(result.assignedUser?.fullName).toBe("Ana Souza")
  })

  it("clears the assignee with null and maps a closed order", async () => {
    apiPut.mockResolvedValueOnce({
      data: makeWorkOrder({ assignedUserId: null, assignedUser: null }),
    })
    const cleared = await updateWorkOrderAssignee(WORK_ORDER_ID, null)
    expect(apiPut).toHaveBeenCalledWith(
      `/api/work-orders/${WORK_ORDER_ID}/assignee`,
      { assignedUserId: null },
    )
    expect(cleared.assignedUserId).toBeNull()

    apiPut.mockRejectedValueOnce(
      axiosError(409, {
        error: "Work order is closed.",
        code: "WORK_ORDER_CLOSED",
      }),
    )
    await expect(updateWorkOrderAssignee(WORK_ORDER_ID, TECHNICIAN_ID)).rejects.toThrow(
      i18n.t("workOrders.errors.workOrderClosed"),
    )
  })
})
