import { get, set, setMany } from "idb-keyval"
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
  clientSequence: z.number().int().nonnegative().optional().default(0),
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

const SYNC_QUEUE_LOCK = "rolvix-os-sync-queue"

let queueLockChain: Promise<void> = Promise.resolve()
let issuedClientSequence = 0

function createQueueItemId(workOrderId: string, taskId: string): string {
  return `${workOrderId}:${taskId}`
}

function queueVersionKey(item: Pick<OsSyncQueueItem, "id" | "clientSequence">): string {
  return `${item.id}#${item.clientSequence}`
}

function hasWebLocks(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.locks?.request === "function"
  )
}

/**
 * Serializes flush, enqueue, and the direct online PATCH.
 * Web Locks covers other tabs; the promise chain covers runtimes without it.
 * Callers already inside the lock must use the unlocked helpers below.
 */
function withSyncQueueLock<T>(operation: () => Promise<T>): Promise<T> {
  const run = (): Promise<T> => {
    if (!hasWebLocks()) {
      return operation()
    }

    return navigator.locks.request(SYNC_QUEUE_LOCK, () => operation())
  }

  const scheduled = queueLockChain.then(run, run)
  queueLockChain = scheduled.then(
    () => undefined,
    () => undefined,
  )
  return scheduled
}

function takeClientSequence(queue: readonly OsSyncQueueItem[]): number {
  let maxSeen = issuedClientSequence
  for (const item of queue) {
    if (item.clientSequence > maxSeen) {
      maxSeen = item.clientSequence
    }
  }

  issuedClientSequence = maxSeen + 1
  return issuedClientSequence
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

type TaskValuePatch = {
  workOrderId: string
  taskId: string
  value: string | null
}

/**
 * Enqueues (or replaces) a pending task-value PATCH.
 * Latest client sequence for the same workOrderId+taskId wins.
 * Caller must already hold `withSyncQueueLock`.
 */
async function putTaskValuePatch(item: TaskValuePatch): Promise<void> {
  const queue = await readSyncQueue()
  const id = createQueueItemId(item.workOrderId, item.taskId)
  const nextItem: OsSyncQueueItem = {
    id,
    workOrderId: item.workOrderId,
    taskId: item.taskId,
    value: item.value,
    queuedAt: new Date().toISOString(),
    clientSequence: takeClientSequence(queue),
  }

  const withoutDuplicate = queue.filter((queued) => queued.id !== id)
  await writeSyncQueue([...withoutDuplicate, nextItem])
}

/** Drops a queued field. Caller must already hold `withSyncQueueLock`. */
async function discardQueuedTaskValue(
  workOrderId: string,
  taskId: string,
): Promise<void> {
  const queue = await readSyncQueue()
  const id = createQueueItemId(workOrderId, taskId)
  const next = queue.filter((queued) => queued.id !== id)
  if (next.length !== queue.length) {
    await writeSyncQueue(next)
  }
}

export async function enqueueTaskValuePatch(item: TaskValuePatch): Promise<void> {
  await withSyncQueueLock(() => putTaskValuePatch(item))
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

async function writeQueueAndConflicts(
  queue: OsSyncQueueItem[],
  conflicts: OsSyncConflict[],
): Promise<void> {
  await setMany([
    [OS_SYNC_QUEUE_KEY, queue],
    [OS_SYNC_CONFLICTS_KEY, conflicts],
  ])
}

export async function listSyncConflicts(): Promise<OsSyncConflict[]> {
  return readConflicts()
}

async function clearSyncConflictBody(
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

export async function retrySyncConflict(
  workOrderId: string,
  taskId: string,
): Promise<ProcessSyncQueueResult> {
  await withSyncQueueLock(async () => {
    const conflicts = await readConflicts()
    const conflict = conflicts.find(
      (item) => item.workOrderId === workOrderId && item.taskId === taskId,
    )

    if (conflict) {
      await putTaskValuePatch({
        workOrderId,
        taskId,
        value: conflict.value,
      })
    }
  })

  return processSyncQueue()
}

export async function clearSyncConflict(
  workOrderId: string,
  taskId: string,
): Promise<void> {
  await withSyncQueueLock(() => clearSyncConflictBody(workOrderId, taskId))
}

type DirectTaskValueResult<T> =
  | { status: "sent"; value: T }
  | { status: "queued" }

/**
 * Online PATCH for one field. Drops any queued value for that field first
 * (this write is the newer client sequence) and holds the queue lock until
 * the request settles, so a stale flush cannot land after it.
 * Network failures are queued. 4xx/5xx propagate with no automatic retry.
 */
export async function commitDirectTaskValuePatch<T>(
  item: TaskValuePatch,
  send: () => Promise<T>,
): Promise<DirectTaskValueResult<T>> {
  return withSyncQueueLock(async () => {
    await discardQueuedTaskValue(item.workOrderId, item.taskId)

    try {
      const value = await send()
      await clearSyncConflictBody(item.workOrderId, item.taskId)
      return { status: "sent", value }
    } catch (error: unknown) {
      if (isNetworkConnectivityError(error)) {
        console.error("commitDirectTaskValuePatch queued after network error", error)
        await putTaskValuePatch(item)
        return { status: "queued" }
      }

      throw error
    }
  })
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

/**
 * Flushes pending PATCH operations to the API.
 * Network and 5xx failures stay queued. 4xx failures are kept as conflicts
 * so the user can see them instead of losing the edit. 4xx is not retried.
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

  const processedKeys = new Set<string>()
  const removedConflictIds = new Set<string>()
  const upsertedConflicts = new Map<string, OsSyncConflict>()
  let processed = 0

  for (const item of queue) {
    try {
      await api.patch(
        `/api/work-orders/${item.workOrderId}/tasks/${item.taskId}`,
        { value: item.value },
      )
      processed += 1
      processedKeys.add(queueVersionKey(item))
      removedConflictIds.add(item.id)
      upsertedConflicts.delete(item.id)
    } catch (error: unknown) {
      console.error("processSyncQueue item failed", {
        item,
        error,
      })

      if (isNetworkConnectivityError(error) || isServerHttpError(error)) {
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
        processedKeys.add(queueVersionKey(item))
        upsertedConflicts.set(item.id, conflict)
        continue
      }
    }
  }

  const latestQueue = await readSyncQueue()
  const latestConflicts = await readConflicts()
  const remaining = latestQueue.filter(
    (item) => !processedKeys.has(queueVersionKey(item)),
  )
  const nextConflicts = latestConflicts.filter(
    (conflict) =>
      !removedConflictIds.has(conflict.id) && !upsertedConflicts.has(conflict.id),
  )
  for (const conflict of upsertedConflicts.values()) {
    nextConflicts.push(conflict)
  }

  await writeQueueAndConflicts(remaining, nextConflicts)

  return {
    processed,
    remaining: remaining.length,
    conflicts: nextConflicts,
  }
}

/**
 * Flushes pending PATCH operations one at a time.
 * Shares the queue lock with enqueue and the direct online PATCH.
 */
export function processSyncQueue(): Promise<ProcessSyncQueueResult> {
  const run = withSyncQueueLock(processSyncQueueBody)

  return run.finally(() => {
    notifySyncQueue()
  })
}
