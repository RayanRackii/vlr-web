import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from "axios"
import {
  clearOfflineSyncScope,
  offlineSyncScopeKeys,
  resetOfflineSyncScopeForTests,
  setOfflineSyncScope,
} from "@/lib/offlineSyncScope"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const store = new Map<string, unknown>()

vi.mock("idb-keyval", () => ({
  get: vi.fn(async (key: string) => store.get(key)),
  del: vi.fn(async (key: string) => {
    store.delete(key)
  }),
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
  syncBackoffDelayMs,
  type OsSyncQueueItem,
} from "@/lib/offlineSync"

const apiPatch = vi.mocked(api.patch)
const setMock = vi.mocked(set)
const setManyMock = vi.mocked(setMany)

function readStoredQueue(): OsSyncQueueItem[] {
  const raw = store.get("os_sync_queue:user-a|tenant-1")
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

setOfflineSyncScope({ userId: "user-a", tenantId: "tenant-1" })

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
      { signal: expect.any(AbortSignal) },
    )
    expect(retried.processed).toBe(1)
    expect(await listSyncConflicts()).toEqual([])
  })

  it("does not let retry replace a newer queued version with the rejected value", async () => {
    const id = `${workOrderId}:${taskId}`
    store.set("os_sync_queue:user-a|tenant-1", [
      {
        id,
        workOrderId,
        taskId,
        value: "newer",
        queuedAt: "2026-10-17T03:00:00.000Z",
        clientSequence: 5,
      },
    ])
    store.set("os_sync_conflicts:user-a|tenant-1", [
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
      { signal: expect.any(AbortSignal) },
    )
    expect(retried.processed).toBe(1)
    expect(await listSyncConflicts()).toEqual([])
    expect(await listQueuedTaskIds()).toEqual([])
  })

  it("does not let retry replace a queued value when the conflict sequence is higher", async () => {
    const id = `${workOrderId}:${taskId}`
    store.set("os_sync_queue:user-a|tenant-1", [
      {
        id,
        workOrderId,
        taskId,
        value: "queued-after-reload",
        queuedAt: "2026-10-18T12:00:00.000Z",
        clientSequence: 1,
      },
    ])
    store.set("os_sync_conflicts:user-a|tenant-1", [
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
      { signal: expect.any(AbortSignal) },
    )
    expect(retried.processed).toBe(1)
    expect(await listSyncConflicts()).toEqual([])
    expect(await listQueuedTaskIds()).toEqual([])
    expect(readStoredQueue()).toEqual([])
  })

  it("keeps a queued value whose queuedAt is earlier than the conflict", async () => {
    const id = `${workOrderId}:${taskId}`
    store.set("os_sync_queue:user-a|tenant-1", [
      {
        id,
        workOrderId,
        taskId,
        value: "kept",
        queuedAt: "2026-10-17T01:00:00.000Z",
        clientSequence: 1,
      },
    ])
    store.set("os_sync_conflicts:user-a|tenant-1", [
      {
        id,
        workOrderId,
        taskId,
        value: "rejected",
        queuedAt: "2026-10-17T04:00:00.000Z",
        clientSequence: 9,
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
      { value: "kept" },
      { signal: expect.any(AbortSignal) },
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
      const current = store.get("os_sync_queue:user-a|tenant-1")
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
      store.set("os_sync_queue:user-a|tenant-1", [newerSameField, otherField])
      return { data: {} }
    })

    const result = await processSyncQueue()

    expect(result.processed).toBe(1)
    expect(result.remaining).toBe(2)
    expect(await listQueuedTaskIds()).toEqual([taskId, otherTaskId])
    const persisted = store.get("os_sync_queue:user-a|tenant-1")
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
      "os_sync_queue:user-a|tenant-1",
      "os_sync_conflicts:user-a|tenant-1",
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
        store.set("os_sync_queue:user-a|tenant-1", [
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
    const reloadedScope = await import("@/lib/offlineSyncScope")
    reloadedScope.setOfflineSyncScope({ userId: "user-a", tenantId: "tenant-1" })
    const apiModule = await import("@/lib/api")
    expect(await reloaded.listQueuedTaskIds()).toEqual([taskId])

    vi.mocked(apiModule.api.patch).mockResolvedValue({ data: {} })
    const flushed = await reloaded.processSyncQueue()

    expect(flushed.processed).toBe(1)
    expect(vi.mocked(apiModule.api.patch)).toHaveBeenCalledWith(
      `/api/work-orders/${workOrderId}/tasks/${taskId}`,
      { value: "kept" },
      { signal: expect.any(AbortSignal) },
    )
    expect(await reloaded.listQueuedTaskIds()).toEqual([])
  })
})

const scopeA = { userId: "user-a", tenantId: "tenant-1" }
const scopeB = { userId: "user-b", tenantId: "tenant-1" }
const scopeATenant2 = { userId: "user-a", tenantId: "tenant-2" }
const workOrderB = "88888888-8888-4888-8888-888888888888"

describe("offline queue scoping", () => {
  beforeEach(() => {
    store.clear()
    apiPatch.mockReset()
    setOfflineSyncScope(scopeA)
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true)
  })

  it("stores the queue under userId and tenantId keys", async () => {
    await enqueueTaskValuePatch({ workOrderId, taskId, value: "a" })

    const keys = offlineSyncScopeKeys(scopeA)
    expect(keys.queue).toBe("os_sync_queue:user-a|tenant-1")
    expect(store.get(keys.queue)).toEqual([expect.objectContaining({ taskId, value: "a" })])
    expect(store.has("os_sync_queue")).toBe(false)
  })

  it("does not show or flush user A's edits to user B, or to the same user in another tenant", async () => {
    await enqueueTaskValuePatch({ workOrderId, taskId, value: "a" })

    for (const other of [scopeB, scopeATenant2]) {
      setOfflineSyncScope(other)
      expect(await listQueuedTaskIds()).toEqual([])
      apiPatch.mockResolvedValue({ data: {} })
      const result = await processSyncQueue()
      expect(result.processed).toBe(0)
      expect(apiPatch).not.toHaveBeenCalled()
    }

    setOfflineSyncScope(scopeA)
    expect(await listQueuedTaskIds()).toEqual([taskId])
  })

  it("drops the legacy unscoped queue instead of flushing it for whoever signs in", async () => {
    store.set("os_sync_queue", [
      { id: `${workOrderId}:${taskId}`, workOrderId, taskId, value: "old", queuedAt: "2026-01-01T00:00:00Z" },
    ])
    resetOfflineSyncScopeForTests()
    setOfflineSyncScope(scopeA)
    await Promise.resolve()

    expect(store.has("os_sync_queue")).toBe(false)
    expect(await listQueuedTaskIds()).toEqual([])
  })

  it("clears the signed-in scope's queue and conflicts on sign-out, leaving other scopes", async () => {
    await enqueueTaskValuePatch({ workOrderId, taskId, value: "a" })
    store.set(offlineSyncScopeKeys(scopeA).conflicts, [])
    store.set(offlineSyncScopeKeys(scopeB).queue, [
      { id: `${workOrderId}:${taskId}`, workOrderId, taskId, value: "b", queuedAt: "x", clientSequence: 1 },
    ])

    await clearOfflineSyncScope()

    expect(store.has(offlineSyncScopeKeys(scopeA).queue)).toBe(false)
    expect(store.has(offlineSyncScopeKeys(scopeA).conflicts)).toBe(false)
    expect(store.has(offlineSyncScopeKeys(scopeB).queue)).toBe(true)
    setOfflineSyncScope(scopeA)
    expect(await listQueuedTaskIds()).toEqual([])
  })
})

describe("offline queue HTTP status handling", () => {
  beforeEach(() => {
    store.clear()
    apiPatch.mockReset()
    setOfflineSyncScope(scopeA)
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true)
    vi.spyOn(Date, "now").mockReturnValue(1_000_000)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("backoff schedule is 1 s doubling up to 60 s", () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 20].map(syncBackoffDelayMs)).toEqual([
      1000, 2000, 4000, 8000, 16000, 32000, 60000, 60000, 60000,
    ])
  })

  it("401 pauses the flush and keeps every item queued", async () => {
    await enqueueTaskValuePatch({ workOrderId, taskId, value: "a" })
    await enqueueTaskValuePatch({ workOrderId: workOrderB, taskId, value: "b" })
    apiPatch.mockRejectedValue(axiosError(401, { error: "Unauthorized" }))

    const result = await processSyncQueue()

    expect(result.remaining).toBe(2)
    expect(result.conflicts).toEqual([])
    expect(apiPatch).toHaveBeenCalledTimes(1)

    // Paused: the next flush does not hit the API again until the pause ends.
    await processSyncQueue()
    expect(apiPatch).toHaveBeenCalledTimes(1)

    // A fresh auth state (sign-in / token refresh) resumes and delivers.
    setOfflineSyncScope(scopeA)
    apiPatch.mockReset()
    apiPatch.mockResolvedValue({ data: {} })
    const resumed = await processSyncQueue()
    expect(resumed.processed).toBe(2)
    expect(resumed.remaining).toBe(0)
  })

  it("403 and 404 become visible conflicts", async () => {
    await enqueueTaskValuePatch({ workOrderId, taskId, value: "a" })
    await enqueueTaskValuePatch({ workOrderId: workOrderB, taskId, value: "b" })
    apiPatch
      .mockRejectedValueOnce(axiosError(403, { error: "Forbidden" }))
      .mockRejectedValueOnce(axiosError(404, { error: "Not found" }))

    const result = await processSyncQueue()

    expect(result.remaining).toBe(0)
    expect(result.conflicts.map((conflict) => conflict.status).sort()).toEqual([403, 404])
  })

  it.each([408, 429, 500])("%i is retried with backoff, not turned into a conflict", async (status) => {
    await enqueueTaskValuePatch({ workOrderId, taskId, value: "a" })
    apiPatch.mockRejectedValue(axiosError(status, { error: "later" }))

    const first = await processSyncQueue()
    expect(first.remaining).toBe(1)
    expect(first.conflicts).toEqual([])
    expect(apiPatch).toHaveBeenCalledTimes(1)

    // Inside the 1 s window: no request.
    vi.mocked(Date.now).mockReturnValue(1_000_000 + 999)
    await processSyncQueue()
    expect(apiPatch).toHaveBeenCalledTimes(1)

    // After 1 s: retried, next wait is 2 s.
    vi.mocked(Date.now).mockReturnValue(1_000_000 + 1_000)
    await processSyncQueue()
    expect(apiPatch).toHaveBeenCalledTimes(2)
    vi.mocked(Date.now).mockReturnValue(1_000_000 + 2_999)
    await processSyncQueue()
    expect(apiPatch).toHaveBeenCalledTimes(2)
    vi.mocked(Date.now).mockReturnValue(1_000_000 + 3_000)
    await processSyncQueue()
    expect(apiPatch).toHaveBeenCalledTimes(3)
  })

  it("a failing work order does not block other work orders, but keeps its own order", async () => {
    await enqueueTaskValuePatch({ workOrderId, taskId, value: "a1" })
    await enqueueTaskValuePatch({ workOrderId, taskId: otherTaskId, value: "a2" })
    await enqueueTaskValuePatch({ workOrderId: workOrderB, taskId, value: "b1" })
    apiPatch.mockImplementation(async (url: string) => {
      if (url.includes(workOrderId)) throw axiosError(503, { error: "down" })
      return { data: {} }
    })

    const result = await processSyncQueue()

    expect(result.processed).toBe(1)
    expect(result.remaining).toBe(2)
    const urls = apiPatch.mock.calls.map(([url]) => url)
    expect(urls).toEqual([
      `/api/work-orders/${workOrderId}/tasks/${taskId}`,
      `/api/work-orders/${workOrderB}/tasks/${taskId}`,
    ])
  })
})
