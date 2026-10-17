import { get, set } from "idb-keyval"
import { z } from "zod"

import { api, isAxiosError } from "@/lib/api"
import { readApiErrorBody } from "@/lib/apiErrorText"

const OS_SYNC_QUEUE_KEY = "os_sync_queue"
const OS_SYNC_CONFLICTS_KEY = "os_sync_conflicts"

const syncQueueItemSchema = z.object({
  id: z.string().min(1),
  workOrderId: z.string().uuid(),
  taskId: z.string().uuid(),
  value: z.string().nullable(),
  queuedAt: z.string().min(1),
})

export type OsSyncQueueItem = z.infer<typeof syncQueueItemSchema>

const syncQueueSchema = z.array(syncQueueItemSchema)

const syncConflictSchema = syncQueueItemSchema.extend({
  status: z.number().int(),
  message: z.string(),
  code: z
    .string()
    .nullish()
    .transform((value) => value ?? null),
  reason: z
    .string()
    .nullish()
    .transform((value) => value ?? null),
})

export type OsSyncConflict = z.infer<typeof syncConflictSchema>

const syncConflictListSchema = z.array(syncConflictSchema)

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

export async function listQueuedTaskIds(): Promise<string[]> {
  const queue = await readSyncQueue()
  return queue.map((item) => item.taskId)
}

async function readConflicts(): Promise<OsSyncConflict[]> {
  const raw = await get<unknown>(OS_SYNC_CONFLICTS_KEY)
  if (raw == null) {
    return []
  }

  const parsed = syncConflictListSchema.safeParse(raw)
  if (!parsed.success) {
    return []
  }

  return parsed.data
}

async function writeConflicts(conflicts: OsSyncConflict[]): Promise<void> {
  await set(OS_SYNC_CONFLICTS_KEY, conflicts)
}

export async function listSyncConflicts(): Promise<OsSyncConflict[]> {
  return readConflicts()
}

export async function retrySyncConflict(
  workOrderId: string,
  taskId: string,
): Promise<ProcessSyncQueueResult> {
  const conflicts = await readConflicts()
  const conflict = conflicts.find(
    (item) => item.workOrderId === workOrderId && item.taskId === taskId,
  )

  if (conflict) {
    await enqueueTaskValuePatch({
      workOrderId,
      taskId,
      value: conflict.value,
    })
  }

  return processSyncQueue()
}

export async function clearSyncConflict(
  workOrderId: string,
  taskId: string,
): Promise<void> {
  const conflicts = await readConflicts()
  const next = conflicts.filter(
    (item) => item.workOrderId !== workOrderId || item.taskId !== taskId,
  )
  if (next.length !== conflicts.length) {
    await writeConflicts(next)
  }
}

function isClientHttpError(error: unknown): boolean {
  return (
    isAxiosError(error) &&
    typeof error.response?.status === "number" &&
    error.response.status >= 400 &&
    error.response.status < 500
  )
}

function isServerHttpError(error: unknown): boolean {
  return (
    isAxiosError(error) &&
    typeof error.response?.status === "number" &&
    error.response.status >= 500
  )
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
  conflicts: OsSyncConflict[]
}

type SyncQueueListener = () => void

const syncQueueListeners = new Set<SyncQueueListener>()

/** Fires after each flush attempt so open pages can drop stale pending state. */
export function subscribeSyncQueue(listener: SyncQueueListener): () => void {
  syncQueueListeners.add(listener)
  return () => {
    syncQueueListeners.delete(listener)
  }
}

function notifySyncQueue(): void {
  for (const listener of syncQueueListeners) {
    try {
      listener()
    } catch (error: unknown) {
      console.error("sync queue listener failed", error)
    }
  }
}

let processSyncQueueTail: Promise<void> = Promise.resolve()

/**
 * Flushes pending PATCH operations to the API.
 * Network and 5xx failures stay queued. 4xx failures are kept as conflicts
 * so the user can see them instead of losing the edit.
 */
async function processSyncQueueBody(): Promise<ProcessSyncQueueResult> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    const queue = await readSyncQueue()
    const conflicts = await readConflicts()
    return { processed: 0, remaining: queue.length, conflicts }
  }

  const queue = await readSyncQueue()
  const conflicts = await readConflicts()

  if (queue.length === 0) {
    return { processed: 0, remaining: 0, conflicts }
  }

  const remaining: OsSyncQueueItem[] = []
  const nextConflicts = [...conflicts]
  let processed = 0

  for (let index = 0; index < queue.length; index += 1) {
    const item = queue[index]
    if (!item) {
      continue
    }

    try {
      await api.patch(
        `/api/work-orders/${item.workOrderId}/tasks/${item.taskId}`,
        { value: item.value },
      )
      processed += 1
      const conflictIndex = nextConflicts.findIndex(
        (conflict) => conflict.id === item.id,
      )
      if (conflictIndex >= 0) {
        nextConflicts.splice(conflictIndex, 1)
      }
    } catch (error: unknown) {
      console.error("processSyncQueue item failed", {
        item,
        error,
      })

      if (isNetworkConnectivityError(error) || isServerHttpError(error)) {
        remaining.push(item, ...queue.slice(index + 1))
        break
      }

      if (isClientHttpError(error)) {
        const body = readApiErrorBody(
          isAxiosError(error) ? error.response?.data : null,
        )
        const status = isAxiosError(error) ? (error.response?.status ?? 400) : 400
        const conflict: OsSyncConflict = {
          ...item,
          status,
          message: body.error ?? body.code ?? "conflict",
          code: body.code,
          reason: body.reason,
        }
        const existing = nextConflicts.findIndex((entry) => entry.id === item.id)
        if (existing >= 0) {
          nextConflicts[existing] = conflict
        } else {
          nextConflicts.push(conflict)
        }
        continue
      }

      remaining.push(item)
    }
  }

  await writeSyncQueue(remaining)
  await writeConflicts(nextConflicts)

  return {
    processed,
    remaining: remaining.length,
    conflicts: nextConflicts,
  }
}

/**
 * Flushes pending PATCH operations one at a time.
 * Overlapping callers (the shell host and the open page) wait their turn so
 * a later empty write cannot drop a 409 conflict.
 */
export function processSyncQueue(): Promise<ProcessSyncQueueResult> {
  const run = processSyncQueueTail.then(processSyncQueueBody, processSyncQueueBody)
  processSyncQueueTail = run.then(
    () => undefined,
    () => undefined,
  )

  return run.finally(() => {
    notifySyncQueue()
  })
}
