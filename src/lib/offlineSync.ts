import { get, set } from "idb-keyval"
import { z } from "zod"

import { api, isAxiosError } from "@/lib/api"

const OS_SYNC_QUEUE_KEY = "os_sync_queue"

const syncQueueItemSchema = z.object({
  id: z.string().min(1),
  workOrderId: z.string().uuid(),
  taskId: z.string().uuid(),
  value: z.string().nullable(),
  queuedAt: z.string().min(1),
})

export type OsSyncQueueItem = z.infer<typeof syncQueueItemSchema>

const syncQueueSchema = z.array(syncQueueItemSchema)

function createQueueItemId(workOrderId: string, taskId: string): string {
  return `${workOrderId}:${taskId}`
}

async function readSyncQueue(): Promise<OsSyncQueueItem[]> {
  const raw = await get<unknown>(OS_SYNC_QUEUE_KEY)

  if (raw == null) {
    return []
  }

  const parsed = syncQueueSchema.safeParse(raw)

  if (!parsed.success) {
    console.error("Invalid os_sync_queue payload in IndexedDB", {
      raw,
      error: parsed.error.flatten(),
    })
    return []
  }

  return parsed.data
}

async function writeSyncQueue(queue: OsSyncQueueItem[]): Promise<void> {
  await set(OS_SYNC_QUEUE_KEY, queue)
}

/**
 * Enqueues (or replaces) a pending task-value PATCH.
 * Latest value for the same workOrderId+taskId wins.
 */
export async function enqueueTaskValuePatch(item: {
  workOrderId: string
  taskId: string
  value: string | null
}): Promise<void> {
  const queue = await readSyncQueue()
  const id = createQueueItemId(item.workOrderId, item.taskId)
  const nextItem: OsSyncQueueItem = {
    id,
    workOrderId: item.workOrderId,
    taskId: item.taskId,
    value: item.value,
    queuedAt: new Date().toISOString(),
  }

  const withoutDuplicate = queue.filter((queued) => queued.id !== id)
  await writeSyncQueue([...withoutDuplicate, nextItem])
}

export async function getSyncQueueLength(): Promise<number> {
  const queue = await readSyncQueue()
  return queue.length
}

export function isNetworkConnectivityError(error: unknown): boolean {
  if (!isAxiosError(error)) {
    return false
  }

  if (error.response) {
    return false
  }

  return (
    error.code === "ERR_NETWORK" ||
    error.code === "ECONNABORTED" ||
    error.message.toLowerCase().includes("network error")
  )
}

export type ProcessSyncQueueResult = {
  processed: number
  remaining: number
}

/**
 * Flushes pending PATCH operations to the API.
 * Items that fail with network errors stay in the queue.
 */
export async function processSyncQueue(): Promise<ProcessSyncQueueResult> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    const queue = await readSyncQueue()
    return { processed: 0, remaining: queue.length }
  }

  const queue = await readSyncQueue()

  if (queue.length === 0) {
    return { processed: 0, remaining: 0 }
  }

  const remaining: OsSyncQueueItem[] = []
  let processed = 0

  for (const item of queue) {
    try {
      await api.patch(`/api/work-orders/${item.workOrderId}/tasks/${item.taskId}`, {
        value: item.value,
      })
      processed += 1
    } catch (error: unknown) {
      console.error("processSyncQueue item failed", {
        item,
        error,
      })

      if (isNetworkConnectivityError(error)) {
        remaining.push(item)
        remaining.push(...queue.slice(queue.indexOf(item) + 1))
        break
      }

      // Non-network failures (4xx/5xx) are dropped to avoid infinite retries
      // of permanently invalid payloads. Log already emitted above.
    }
  }

  await writeSyncQueue(remaining)

  return {
    processed,
    remaining: remaining.length,
  }
}
