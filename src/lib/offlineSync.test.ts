import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from "axios"
import { beforeEach, describe, expect, it, vi } from "vitest"

const store = new Map<string, unknown>()

vi.mock("idb-keyval", () => ({
  get: vi.fn(async (key: string) => store.get(key)),
  set: vi.fn(async (key: string, value: unknown) => {
    store.set(key, value)
  }),
  setMany: vi.fn(async (entries: ReadonlyArray<readonly [string, unknown]>) => {
    for (const [key, value] of entries) {
      store.set(key, value)
    }
  }),
}))

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>()
  return {
    ...actual,
    api: {
      patch: vi.fn(),
    },
  }
})

import { set, setMany } from "idb-keyval"
import { api } from "@/lib/api"
import {
  clearSyncConflict,
  commitDirectTaskValuePatch,
  enqueueTaskValuePatch,
  listQueuedTaskIds,
  listSyncConflicts,
  processSyncQueue,
  retrySyncConflict,
  subscribeSyncQueue,
  type OsSyncQueueItem,
} from "@/lib/offlineSync"

const apiPatch = vi.mocked(api.patch)
const setMock = vi.mocked(set)
const setManyMock = vi.mocked(setMany)

function readStoredQueue(): OsSyncQueueItem[] {
  const raw = store.get("os_sync_queue")
  return Array.isArray(raw) ? (raw as OsSyncQueueItem[]) : []
}

function networkError(): AxiosError {
  const error = new AxiosError("Network Error")
  error.code = "ERR_NETWORK"
  return error
}

const otherTaskId = "17171717-1717-4171-8171-171717171717"

const workOrderId = "99999999-9999-4999-8999-999999999999"
const taskId = "16161616-1616-4161-8161-161616161616"

function axiosError(status: number, data: unknown): AxiosError {
  const error = new AxiosError("Request failed")
  error.response = {
    status,
    data,
    statusText: "Error",
    headers: {},
    config: { headers: {} } as InternalAxiosRequestConfig,
  } as AxiosResponse
  return error
}

describe("processSyncQueue", () => {
  beforeEach(() => {
    store.clear()
    apiPatch.mockReset()
    setManyMock.mockClear()
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true)
  })

  it("keeps a 4xx as a visible conflict instead of dropping it", async () => {
    await enqueueTaskValuePatch({
      workOrderId,
      taskId,
      value: "local",
    })
    apiPatch.mockRejectedValue(axiosError(409, { error: "Rejected" }))

    const result = await processSyncQueue()

    expect(result.processed).toBe(0)
    expect(result.remaining).toBe(0)
    expect(result.conflicts).toEqual([
      expect.objectContaining({
        workOrderId,
        taskId,
        status: 409,
        message: "Rejected",
      }),
    ])
    expect(await listQueuedTaskIds()).toEqual([])
    expect(await listSyncConflicts()).toHaveLength(1)
    expect(apiPatch).toHaveBeenCalledTimes(1)
  })

  it("keeps the queue when the server returns 5xx", async () => {
    await enqueueTaskValuePatch({
      workOrderId,
      taskId,
      value: "local",
    })
    apiPatch.mockRejectedValue(axiosError(503, { error: "Unavailable" }))

    const result = await processSyncQueue()

    expect(result.remaining).toBe(1)
    expect(result.conflicts).toEqual([])
    expect(await listQueuedTaskIds()).toEqual([taskId])
  })

  it("keeps a closed work order conflict with its code and allows discard", async () => {
    await enqueueTaskValuePatch({
      workOrderId,
      taskId,
      value: "true",
    })
    apiPatch.mockRejectedValue(
      axiosError(409, {
        error: "Work order is completed or canceled and cannot be changed.",
        code: "WORK_ORDER_CLOSED",
      }),
    )

    const result = await processSyncQueue()

    expect(result.conflicts).toEqual([
      expect.objectContaining({
        taskId,
        code: "WORK_ORDER_CLOSED",
        reason: null,
      }),
    ])

    await clearSyncConflict(workOrderId, taskId)
    expect(await listSyncConflicts()).toEqual([])
  })

  it("retries a conflict by sending the stored value again", async () => {
    await enqueueTaskValuePatch({
      workOrderId,
      taskId,
      value: "12",
    })
    apiPatch.mockRejectedValueOnce(
      axiosError(400, {
        error: "Number values must be a decimal number.",
        code: "INVALID_TASK_VALUE",
        reason: "NOT_A_NUMBER",
      }),
    )
    await processSyncQueue()
    apiPatch.mockResolvedValueOnce({ data: {} })

    const retried = await retrySyncConflict(workOrderId, taskId)

    expect(apiPatch).toHaveBeenLastCalledWith(
      `/api/work-orders/${workOrderId}/tasks/${taskId}`,
      { value: "12" },
    )
    expect(retried.processed).toBe(1)
    expect(await listSyncConflicts()).toEqual([])
  })

  it("does not let retry replace a newer queued version with the rejected value", async () => {
    const id = `${workOrderId}:${taskId}`
    store.set("os_sync_queue", [
      {
        id,
        workOrderId,
        taskId,
        value: "newer",
        queuedAt: "2026-10-17T03:00:00.000Z",
        clientSequence: 5,
      },
    ])
    store.set("os_sync_conflicts", [
      {
        id,
        workOrderId,
        taskId,
        value: "rejected",
        queuedAt: "2026-10-17T02:00:00.000Z",
        clientSequence: 2,
        status: 409,
        message: "Rejected",
        code: "WORK_ORDER_CLOSED",
        reason: null,
      },
    ])
    apiPatch.mockResolvedValue({ data: {} })

    const retried = await retrySyncConflict(workOrderId, taskId)

    expect(apiPatch).toHaveBeenCalledTimes(1)
    expect(apiPatch).toHaveBeenCalledWith(
      `/api/work-orders/${workOrderId}/tasks/${taskId}`,
      { value: "newer" },
    )
    expect(retried.processed).toBe(1)
    expect(await listSyncConflicts()).toEqual([])
    expect(await listQueuedTaskIds()).toEqual([])
  })

  it("does not let retry replace a queued value when the conflict sequence is higher", async () => {
    const id = `${workOrderId}:${taskId}`
    store.set("os_sync_queue", [
      {
        id,
        workOrderId,
        taskId,
        value: "queued-after-reload",
        queuedAt: "2026-10-18T12:00:00.000Z",
        clientSequence: 1,
      },
    ])
    store.set("os_sync_conflicts", [
      {
        id,
        workOrderId,
        taskId,
        value: "rejected",
        queuedAt: "2026-10-17T02:00:00.000Z",
        clientSequence: 40,
        status: 409,
        message: "Rejected",
        code: "WORK_ORDER_CLOSED",
        reason: null,
      },
    ])
    apiPatch.mockResolvedValue({ data: {} })

    const retried = await retrySyncConflict(workOrderId, taskId)

    expect(apiPatch).toHaveBeenCalledTimes(1)
    expect(apiPatch).toHaveBeenCalledWith(
      `/api/work-orders/${workOrderId}/tasks/${taskId}`,
      { value: "queued-after-reload" },
    )
    expect(retried.processed).toBe(1)
    expect(await listSyncConflicts()).toEqual([])
    expect(await listQueuedTaskIds()).toEqual([])
    expect(readStoredQueue()).toEqual([])
  })

  it("does not let an in-flight stale flush finish after a newer direct patch", async () => {
    await enqueueTaskValuePatch({
      workOrderId,
      taskId,
      value: "stale",
    })

    let releaseStale: () => void = () => undefined
    const staleGate = new Promise<void>((resolve) => {
      releaseStale = resolve
    })
    const completed: string[] = []

    apiPatch.mockImplementation(async (_url: string, body: unknown) => {
      const value =
        typeof body === "object" && body !== null && "value" in body
          ? (body as { value?: unknown }).value
          : null
      if (value === "stale") {
        await staleGate
      }
      completed.push(typeof value === "string" ? value : "")
      return { data: {} }
    })

    const flushPromise = processSyncQueue()
    await vi.waitUntil(() => apiPatch.mock.calls.length >= 1)

    const directPromise = commitDirectTaskValuePatch(
      { workOrderId, taskId, value: "fresh" },
      () =>
        api.patch(`/api/work-orders/${workOrderId}/tasks/${taskId}`, {
          value: "fresh",
        }),
    )

    await new Promise((resolve) => {
      setTimeout(resolve, 0)
    })
    expect(apiPatch.mock.calls).toHaveLength(1)
    expect(completed).toEqual([])

    releaseStale()
    await flushPromise
    await directPromise

    expect(completed).toEqual(["stale", "fresh"])
    expect(await listQueuedTaskIds()).toEqual([])
  })

  it("drops a queued value when a newer direct patch is sent first", async () => {
    await enqueueTaskValuePatch({
      workOrderId,
      taskId,
      value: "stale",
    })
    apiPatch.mockResolvedValue({ data: {} })

    await commitDirectTaskValuePatch(
      { workOrderId, taskId, value: "fresh" },
      () =>
        api.patch(`/api/work-orders/${workOrderId}/tasks/${taskId}`, {
          value: "fresh",
        }),
    )
    const result = await processSyncQueue()

    expect(result.processed).toBe(0)
    expect(apiPatch).toHaveBeenCalledTimes(1)
    expect(apiPatch).toHaveBeenCalledWith(
      `/api/work-orders/${workOrderId}/tasks/${taskId}`,
      { value: "fresh" },
    )
    expect(await listQueuedTaskIds()).toEqual([])
  })

  it("keeps a queue write that lands while flush is awaiting the network", async () => {
    await enqueueTaskValuePatch({
      workOrderId,
      taskId,
      value: "sent",
    })

    apiPatch.mockImplementation(async () => {
      const current = store.get("os_sync_queue")
      const queue = Array.isArray(current) ? (current as OsSyncQueueItem[]) : []
      const sent = queue.find((item) => item.taskId === taskId)
      const sequence = sent?.clientSequence ?? 0
      const newerSameField: OsSyncQueueItem = {
        id: `${workOrderId}:${taskId}`,
        workOrderId,
        taskId,
        value: "newer-same-field",
        queuedAt: "2026-10-17T01:00:00.000Z",
        clientSequence: sequence + 1,
      }
      const otherField: OsSyncQueueItem = {
        id: `${workOrderId}:${otherTaskId}`,
        workOrderId,
        taskId: otherTaskId,
        value: "other",
        queuedAt: "2026-10-17T01:00:01.000Z",
        clientSequence: sequence + 2,
      }
      store.set("os_sync_queue", [newerSameField, otherField])
      return { data: {} }
    })

    const result = await processSyncQueue()

    expect(result.processed).toBe(1)
    expect(result.remaining).toBe(2)
    expect(await listQueuedTaskIds()).toEqual([taskId, otherTaskId])
    const persisted = store.get("os_sync_queue")
    expect(persisted).toEqual([
      expect.objectContaining({ taskId, value: "newer-same-field" }),
      expect.objectContaining({ taskId: otherTaskId, value: "other" }),
    ])
  })

  it("keeps the queued 409 when the atomic conflict write fails", async () => {
    await enqueueTaskValuePatch({
      workOrderId,
      taskId,
      value: "local",
    })
    apiPatch.mockRejectedValue(
      axiosError(409, { error: "Rejected", code: "WORK_ORDER_CLOSED" }),
    )
    setManyMock.mockImplementationOnce(async () => {
      throw new Error("IndexedDB transaction aborted")
    })

    await expect(processSyncQueue()).rejects.toThrow(
      "IndexedDB transaction aborted",
    )

    expect(setManyMock).toHaveBeenCalledTimes(1)
    const entries = setManyMock.mock.calls[0]?.[0]
    expect(entries?.map(([key]) => key)).toEqual([
      "os_sync_queue",
      "os_sync_conflicts",
    ])
    expect(await listQueuedTaskIds()).toEqual([taskId])
    expect(await listSyncConflicts()).toEqual([])
    expect(apiPatch).toHaveBeenCalledTimes(1)
  })
})

describe("commitDirectTaskValuePatch", () => {
  beforeEach(() => {
    store.clear()
    apiPatch.mockReset()
    setMock.mockClear()
    setManyMock.mockClear()
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true)
  })

  it("keeps the new value queued and supersedes the old one on 5xx", async () => {
    await enqueueTaskValuePatch({
      workOrderId,
      taskId,
      value: "old",
    })
    const previous = readStoredQueue()[0]?.clientSequence ?? 0
    let duringSend: OsSyncQueueItem[] = []

    const outcome = await commitDirectTaskValuePatch(
      { workOrderId, taskId, value: "new" },
      async () => {
        duringSend = readStoredQueue()
        throw axiosError(503, { error: "Unavailable" })
      },
    )

    expect(outcome).toEqual({ status: "queued" })
    expect(duringSend).toEqual([
      expect.objectContaining({ taskId, value: "new" }),
    ])
    const stored = readStoredQueue()
    expect(stored).toEqual([
      expect.objectContaining({ taskId, value: "new" }),
    ])
    expect(stored[0]?.clientSequence).toBeGreaterThan(previous)
    expect(await listSyncConflicts()).toEqual([])
  })

  it.each([
    {
      label: "5xx",
      fail: () => axiosError(503, { error: "Unavailable" }),
    },
    {
      label: "network error",
      fail: () => networkError(),
    },
  ])(
    "clears an older field conflict when a $label keeps the newer version queued",
    async ({ fail }) => {
      await enqueueTaskValuePatch({
        workOrderId,
        taskId,
        value: "rejected",
      })
      apiPatch.mockRejectedValueOnce(
        axiosError(409, { error: "Rejected", code: "WORK_ORDER_CLOSED" }),
      )
      await processSyncQueue()
      expect(await listSyncConflicts()).toHaveLength(1)

      const outcome = await commitDirectTaskValuePatch(
        { workOrderId, taskId, value: "newer" },
        async () => {
          throw fail()
        },
      )

      expect(outcome).toEqual({ status: "queued" })
      expect(readStoredQueue()).toEqual([
        expect.objectContaining({ taskId, value: "newer" }),
      ])
      expect(await listSyncConflicts()).toEqual([])
    },
  )

  it("keeps the new value queued when the direct patch hits a network error", async () => {
    await enqueueTaskValuePatch({
      workOrderId,
      taskId,
      value: "old",
    })

    const outcome = await commitDirectTaskValuePatch(
      { workOrderId, taskId, value: "new" },
      async () => {
        throw networkError()
      },
    )

    expect(outcome).toEqual({ status: "queued" })
    expect(readStoredQueue()).toEqual([
      expect.objectContaining({ taskId, value: "new" }),
    ])
    expect(await listSyncConflicts()).toEqual([])
  })

  it("keeps the old value when the second write fails", async () => {
    await enqueueTaskValuePatch({
      workOrderId,
      taskId,
      value: "old",
    })
    const send = vi.fn(async () => "should-not-send")
    setMock.mockImplementationOnce(async () => {
      throw new Error("IndexedDB write failed")
    })

    await expect(
      commitDirectTaskValuePatch(
        { workOrderId, taskId, value: "new" },
        send,
      ),
    ).rejects.toThrow("IndexedDB write failed")

    expect(send).not.toHaveBeenCalled()
    expect(readStoredQueue()).toEqual([
      expect.objectContaining({ taskId, value: "old" }),
    ])
    expect(await listSyncConflicts()).toEqual([])
  })

  it("moves a direct 4xx into the conflict store and surfaces the error", async () => {
    await enqueueTaskValuePatch({
      workOrderId,
      taskId,
      value: "old",
    })
    await enqueueTaskValuePatch({
      workOrderId,
      taskId: otherTaskId,
      value: "other",
    })
    const error = axiosError(409, {
      error: "Rejected",
      code: "WORK_ORDER_CLOSED",
    })

    await expect(
      commitDirectTaskValuePatch(
        { workOrderId, taskId, value: "new" },
        async () => {
          throw error
        },
      ),
    ).rejects.toBe(error)

    expect(await listQueuedTaskIds()).toEqual([otherTaskId])
    expect(await listSyncConflicts()).toEqual([
      expect.objectContaining({
        workOrderId,
        taskId,
        value: "new",
        status: 409,
        message: "Rejected",
        code: "WORK_ORDER_CLOSED",
      }),
    ])
  })

  it("notifies subscribers after a direct 4xx records a conflict", async () => {
    let snapshot: Promise<unknown> = Promise.resolve(null)
    const unsubscribe = subscribeSyncQueue(() => {
      snapshot = listSyncConflicts()
    })
    const error = axiosError(409, {
      error: "Rejected",
      code: "WORK_ORDER_CLOSED",
    })

    try {
      await expect(
        commitDirectTaskValuePatch(
          { workOrderId, taskId, value: "new" },
          async () => {
            throw error
          },
        ),
      ).rejects.toBe(error)

      expect(await snapshot).toEqual([
        expect.objectContaining({
          workOrderId,
          taskId,
          value: "new",
          status: 409,
          message: "Rejected",
        }),
      ])
    } finally {
      unsubscribe()
    }
  })

  it("removes the sent entry and clears the conflict after success", async () => {
    await enqueueTaskValuePatch({
      workOrderId,
      taskId,
      value: "stale",
    })
    apiPatch.mockRejectedValueOnce(
      axiosError(409, { error: "Rejected", code: "WORK_ORDER_CLOSED" }),
    )
    await processSyncQueue()
    expect(await listSyncConflicts()).toHaveLength(1)

    let duringSend: OsSyncQueueItem[] = []
    const outcome = await commitDirectTaskValuePatch(
      { workOrderId, taskId, value: "fresh" },
      async () => {
        duringSend = readStoredQueue()
        return { saved: true }
      },
    )

    expect(duringSend).toEqual([
      expect.objectContaining({ taskId, value: "fresh" }),
    ])
    expect(outcome).toEqual({ status: "sent", value: { saved: true } })
    expect(await listQueuedTaskIds()).toEqual([])
    expect(await listSyncConflicts()).toEqual([])
  })

  it("removes only the sent version when a newer value lands during the request", async () => {
    await enqueueTaskValuePatch({
      workOrderId,
      taskId,
      value: "old",
    })
    let newerSequence = 0

    const outcome = await commitDirectTaskValuePatch(
      { workOrderId, taskId, value: "sent" },
      async () => {
        const sent = readStoredQueue().find((item) => item.taskId === taskId)
        const sequence = sent?.clientSequence ?? 0
        newerSequence = sequence + 1
        store.set("os_sync_queue", [
          {
            id: `${workOrderId}:${taskId}`,
            workOrderId,
            taskId,
            value: "newer",
            queuedAt: "2026-10-17T02:00:00.000Z",
            clientSequence: newerSequence,
          },
        ])
        return { saved: true }
      },
    )

    expect(outcome).toEqual({ status: "sent", value: { saved: true } })
    expect(readStoredQueue()).toEqual([
      expect.objectContaining({
        taskId,
        value: "newer",
        clientSequence: newerSequence,
      }),
    ])
  })

  it("still has the new value after a reload simulation following 5xx", async () => {
    await enqueueTaskValuePatch({
      workOrderId,
      taskId,
      value: "old",
    })

    const outcome = await commitDirectTaskValuePatch(
      { workOrderId, taskId, value: "kept" },
      async () => {
        throw axiosError(503, { error: "Unavailable" })
      },
    )
    expect(outcome).toEqual({ status: "queued" })
    expect(readStoredQueue()).toEqual([
      expect.objectContaining({ taskId, value: "kept" }),
    ])

    vi.resetModules()
    const reloaded = await import("@/lib/offlineSync")
    const apiModule = await import("@/lib/api")
    expect(await reloaded.listQueuedTaskIds()).toEqual([taskId])

    vi.mocked(apiModule.api.patch).mockResolvedValue({ data: {} })
    const flushed = await reloaded.processSyncQueue()

    expect(flushed.processed).toBe(1)
    expect(vi.mocked(apiModule.api.patch)).toHaveBeenCalledWith(
      `/api/work-orders/${workOrderId}/tasks/${taskId}`,
      { value: "kept" },
    )
    expect(await reloaded.listQueuedTaskIds()).toEqual([])
  })
})
