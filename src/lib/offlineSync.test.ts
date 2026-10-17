import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from "axios"
import { beforeEach, describe, expect, it, vi } from "vitest"

const store = new Map<string, unknown>()

vi.mock("idb-keyval", () => ({
  get: vi.fn(async (key: string) => store.get(key)),
  set: vi.fn(async (key: string, value: unknown) => {
    store.set(key, value)
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

import { api } from "@/lib/api"
import {
  enqueueTaskValuePatch,
  listQueuedTaskIds,
  listSyncConflicts,
  processSyncQueue,
} from "@/lib/offlineSync"

const apiPatch = vi.mocked(api.patch)

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
})
