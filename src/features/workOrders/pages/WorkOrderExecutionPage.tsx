import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { ArrowLeft, CircleCheck, Play } from "lucide-react"
import { useTranslation } from "react-i18next"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { LoadingButton } from "@/components/ui/loading-button"
import { PageContentSkeleton } from "@/components/loading/PageContentSkeleton"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/contexts/AuthContext"
import { WorkOrderOfflineBanner } from "@/features/workOrders/components/WorkOrderOfflineBanner"
import { WorkOrderTaskImageField } from "@/features/workOrders/components/WorkOrderTaskImageField"
import { WorkOrderOrigin } from "@/features/workOrders/components/WorkOrderOrigin"
import {
  parseNumberConfiguration,
  parseSingleChoiceConfiguration,
  type WorkOrder,
  type WorkOrderTask,
} from "@/features/workOrders/schemas/workOrderSchemas"
import { localizeWorkOrderApiError } from "@/features/workOrders/lib/workOrderApiErrors"
import { isWorkOrderTaskFilled } from "@/features/workOrders/lib/workOrderTaskFilled"
import {
  getWorkOrderById,
  updateTaskValue,
  updateWorkOrderStatus,
} from "@/features/workOrders/services/workOrdersService"
import { useDebouncedCallback } from "@/hooks/useDebouncedCallback"
import { isAxiosError } from "@/lib/api"
import {
  clearSyncConflict,
  listQueuedTaskIds,
  listSyncConflicts,
  processSyncQueue,
  retrySyncConflict,
  subscribeSyncQueue,
  type OsSyncConflict,
} from "@/lib/offlineSync"

function formatScheduledDate(value: string, locale: string): string {
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date)
}

function formatCompletedDate(value: string, locale: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return formatScheduledDate(value, locale)
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

function mergeWorkOrderDrafts(
  data: WorkOrder,
  queuedConflicts: readonly OsSyncConflict[],
  drafts: Map<string, string | null>,
): WorkOrder {
  return {
    ...data,
    tasks: data.tasks.map((task) => {
      const serverValue = task.value ?? null
      const draft = drafts.get(task.id)
      if (draft !== undefined && draft !== serverValue) {
        return { ...task, value: draft }
      }

      const conflict = queuedConflicts.find(
        (item) => item.workOrderId === data.id && item.taskId === task.id,
      )
      if (
        (serverValue == null || serverValue === "") &&
        conflict?.value != null &&
        conflict.value !== ""
      ) {
        drafts.set(task.id, conflict.value)
        return { ...task, value: conflict.value }
      }

      drafts.set(task.id, serverValue)
      return task
    }),
  }
}

function SyncConflictList({
  conflicts,
  tasks,
  busyId,
  onDiscard,
  onRetry,
}: {
  conflicts: readonly OsSyncConflict[]
  tasks: readonly WorkOrderTask[] | null
  busyId: string | null
  onDiscard: (conflict: OsSyncConflict) => void
  onRetry: (conflict: OsSyncConflict) => void
}) {
  const { t } = useTranslation()

  if (conflicts.length === 0) {
    return null
  }

  return (
    <Alert variant="destructive">
      <AlertTitle>{t("workOrders.offline.conflictTitle")}</AlertTitle>
      <AlertDescription>
        <p>{t("workOrders.offline.conflictBody")}</p>
        <ul className="mt-3 space-y-3">
          {conflicts.map((conflict) => {
            const task = tasks?.find((item) => item.id === conflict.taskId)
            const field =
              task?.title.trim() !== "" && task != null
                ? task.title
                : t("workOrders.offline.conflictUnknownField")
            const reason = localizeWorkOrderApiError(
              {
                code: conflict.code,
                error: conflict.message,
                reason: conflict.reason,
              },
              t("workOrders.errors.updateTaskFailed"),
            )
            const busy = busyId === conflict.id

            return (
              <li key={conflict.id} className="space-y-2">
                <p>
                  {t("workOrders.offline.conflictField", {
                    field,
                    reason,
                  })}
                </p>
                {conflict.value != null && conflict.value !== "" ? (
                  <p>
                    {t("workOrders.offline.conflictValue", {
                      value: conflict.value,
                    })}
                  </p>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    aria-label={t("workOrders.offline.discardNamed", {
                      field,
                    })}
                    onClick={() => {
                      onDiscard(conflict)
                    }}
                  >
                    {t("workOrders.offline.discard")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    aria-label={t("workOrders.offline.retryNamed", {
                      field,
                    })}
                    onClick={() => {
                      onRetry(conflict)
                    }}
                  >
                    {t("workOrders.offline.retry")}
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      </AlertDescription>
    </Alert>
  )
}

function TaskField({
  workOrderId,
  task,
  disabled,
  pendingSync,
  onLocalChange,
  onPersisted,
  onQueued,
  onError,
  onRegisterFlush,
}: {
  workOrderId: string
  task: WorkOrderTask
  disabled: boolean
  pendingSync: boolean
  onLocalChange: (taskId: string, value: string | null) => void
  onPersisted: (workOrder: WorkOrder, taskId: string) => void
  onQueued: (taskId: string) => void
  onError: (message: string) => void
  onRegisterFlush: (taskId: string, flush: (() => unknown) | null) => void
}) {
  const { t } = useTranslation()

  const persistValue = useCallback(
    async (value: string | null) => {
      try {
        const updated = await updateTaskValue(workOrderId, task.id, value)
        if (updated !== null) {
          onPersisted(updated, task.id)
        } else {
          onQueued(task.id)
        }
      } catch (error: unknown) {
        console.error("TaskField persistValue failed", error)
        if (isAxiosError(error)) {
          console.error("TaskField persistValue response", error.response?.data)
        }

        onError(
          error instanceof Error
            ? error.message
            : t("workOrders.errors.updateTaskFailed"),
        )
      }
    },
    [onError, onPersisted, onQueued, t, task.id, workOrderId],
  )

  const debouncedPersist = useDebouncedCallback(
    (value: string | null) => persistValue(value),
    400,
  )

  useEffect(() => {
    onRegisterFlush(task.id, () => debouncedPersist.flush())
    return () => {
      onRegisterFlush(task.id, null)
    }
  }, [debouncedPersist, onRegisterFlush, task.id])

  const numberConfig = useMemo(
    () => parseNumberConfiguration(task.configuration),
    [task.configuration],
  )

  const choiceConfig = useMemo(
    () => parseSingleChoiceConfiguration(task.configuration),
    [task.configuration],
  )

  const choiceOptions = choiceConfig?.options ?? []

  const waiting = pendingSync ? (
    <p className="text-xs text-amber-800 dark:text-amber-200">
      {t("workOrders.offline.waitingToSync")}
    </p>
  ) : null

  switch (task.inputType) {
    case "Checkbox": {
      const checked = task.value === "true"

      return (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
            <span className="text-sm text-muted-foreground">
              {t("workOrders.execution.checkboxHint")}
            </span>
            <Switch
              checked={checked}
              disabled={disabled}
              onCheckedChange={(nextChecked) => {
                const nextValue = nextChecked ? "true" : "false"
                onLocalChange(task.id, nextValue)
                void persistValue(nextValue)
              }}
            />
          </div>
          {waiting}
        </div>
      )
    }

    case "Text":
      return (
        <div className="space-y-2">
          <Textarea
            value={task.value ?? ""}
            disabled={disabled}
            placeholder={t("workOrders.execution.textPlaceholder")}
            onChange={(event) => {
              const nextValue =
                event.target.value.trim() === "" ? null : event.target.value
              onLocalChange(task.id, nextValue)
              debouncedPersist(nextValue)
            }}
          />
          {waiting}
        </div>
      )

    case "Number":
      return (
        <div className="space-y-2">
          {numberConfig?.min != null || numberConfig?.max != null ? (
            <p className="text-xs text-muted-foreground">
              {t("workOrders.execution.numberRange", {
                min: numberConfig.min ?? "—",
                max: numberConfig.max ?? "—",
                unit: numberConfig.unit ? ` ${numberConfig.unit}` : "",
              })}
            </p>
          ) : null}
          <Input
            type="number"
            inputMode="decimal"
            disabled={disabled}
            min={numberConfig?.min}
            max={numberConfig?.max}
            value={task.value ?? ""}
            placeholder={t("workOrders.execution.numberPlaceholder")}
            onChange={(event) => {
              const raw = event.target.value
              const nextValue = raw.trim() === "" ? null : raw
              onLocalChange(task.id, nextValue)
              debouncedPersist(nextValue)
            }}
          />
          {waiting}
        </div>
      )

    case "SingleChoice":
      if (choiceOptions.length === 0) {
        return (
          <p className="text-sm text-muted-foreground">
            {t("workOrders.execution.choiceEmpty")}
          </p>
        )
      }

      return (
        <div className="space-y-2">
          <select
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label={task.title}
            disabled={disabled}
            value={task.value ?? ""}
            onChange={(event) => {
              const nextValue =
                event.target.value === "" ? null : event.target.value
              onLocalChange(task.id, nextValue)
              void persistValue(nextValue)
            }}
          >
            <option value="">
              {t("workOrders.execution.choicePlaceholder")}
            </option>
            {choiceOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          {waiting}
        </div>
      )

    case "Image":
      return (
        <WorkOrderTaskImageField
          workOrderId={workOrderId}
          task={task}
          disabled={disabled}
          onUploaded={(fileId) => {
            onLocalChange(task.id, fileId)
          }}
        />
      )

    default:
      return null
  }
}

export function WorkOrderExecutionPage() {
  const { t, i18n } = useTranslation()
  const { session } = useAuth()
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()

  const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [pendingTaskIds, setPendingTaskIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  )
  const [conflicts, setConflicts] = useState<OsSyncConflict[]>([])
  const [conflictBusyId, setConflictBusyId] = useState<string | null>(null)
  const loadFailedRef = useRef(false)
  const hasWorkOrderRef = useRef(false)
  const flushersRef = useRef(new Map<string, () => unknown>())
  const draftValuesRef = useRef(new Map<string, string | null>())

  const loadWorkOrder = useCallback(async () => {
    if (!session) {
      setErrorMessage(t("workOrders.errors.unauthorized"))
      setIsLoading(false)
      return
    }

    if (!id) {
      setErrorMessage(t("workOrders.errors.loadOneFailed"))
      setIsLoading(false)
      return
    }

    const background = hasWorkOrderRef.current
    if (!background) {
      setIsLoading(true)
    }

    try {
      const data = await getWorkOrderById(id)
      const queuedConflicts = await listSyncConflicts()
      loadFailedRef.current = false
      hasWorkOrderRef.current = true
      setWorkOrder(mergeWorkOrderDrafts(data, queuedConflicts, draftValuesRef.current))
      setErrorMessage(null)
    } catch (error: unknown) {
      console.error("WorkOrderExecutionPage loadWorkOrder failed", error)
      if (isAxiosError(error)) {
        console.error(
          "WorkOrderExecutionPage loadWorkOrder response",
          error.response?.data,
        )
      }

      loadFailedRef.current = true
      setErrorMessage(
        error instanceof Error
          ? error.message
          : t("workOrders.errors.loadOneFailed"),
      )
    } finally {
      setIsLoading(false)
    }
  }, [id, session, t])

  const refreshSyncState = useCallback(async () => {
    const [queued, queuedConflicts] = await Promise.all([
      listQueuedTaskIds(),
      listSyncConflicts(),
    ])
    const visibleConflicts = id
      ? queuedConflicts.filter((conflict) => conflict.workOrderId === id)
      : queuedConflicts
    setPendingTaskIds(new Set(queued))
    setConflicts(visibleConflicts)
    setWorkOrder((current) => {
      if (!current) {
        return current
      }

      return mergeWorkOrderDrafts(
        current,
        visibleConflicts,
        draftValuesRef.current,
      )
    })
  }, [id])

  useEffect(() => {
    void loadWorkOrder()
  }, [loadWorkOrder])

  useEffect(() => {
    const unsubscribe = subscribeSyncQueue(() => {
      void refreshSyncState()
    })

    const syncAndRefresh = () => {
      void processSyncQueue()
        .catch((error: unknown) => {
          console.error("WorkOrderExecutionPage processSyncQueue failed", error)
        })
        .finally(() => {
          void refreshSyncState()
        })
    }

    const handleOnline = () => {
      void processSyncQueue()
        .catch((error: unknown) => {
          console.error("WorkOrderExecutionPage processSyncQueue failed", error)
        })
        .finally(() => {
          void refreshSyncState()
          if (hasWorkOrderRef.current || loadFailedRef.current) {
            void loadWorkOrder()
          }
        })
    }

    window.addEventListener("online", handleOnline)
    void refreshSyncState()

    if (navigator.onLine) {
      syncAndRefresh()
    }

    return () => {
      unsubscribe()
      window.removeEventListener("online", handleOnline)
    }
  }, [loadWorkOrder, refreshSyncState])

  async function discardConflict(conflict: OsSyncConflict) {
    setConflictBusyId(conflict.id)
    try {
      await clearSyncConflict(conflict.workOrderId, conflict.taskId)
      await refreshSyncState()
    } catch (error: unknown) {
      console.error("WorkOrderExecutionPage discardConflict failed", error)
    } finally {
      setConflictBusyId(null)
    }
  }

  async function retryConflict(conflict: OsSyncConflict) {
    setConflictBusyId(conflict.id)
    try {
      const result = await retrySyncConflict(
        conflict.workOrderId,
        conflict.taskId,
      )
      await refreshSyncState()
      if (result.processed > 0 && id) {
        const data = await getWorkOrderById(id)
        const queuedConflicts = await listSyncConflicts()
        hasWorkOrderRef.current = true
        setWorkOrder(
          mergeWorkOrderDrafts(data, queuedConflicts, draftValuesRef.current),
        )
      }
    } catch (error: unknown) {
      console.error("WorkOrderExecutionPage retryConflict failed", error)
    } finally {
      setConflictBusyId(null)
    }
  }

  const isReadOnly =
    workOrder?.status === "Completed" || workOrder?.status === "Canceled"

  const orderedTasks = useMemo(() => {
    if (!workOrder) {
      return []
    }

    return [...workOrder.tasks].sort((a, b) => a.order - b.order)
  }, [workOrder])

  const registerFlush = useCallback(
    (taskId: string, flush: (() => unknown) | null) => {
      if (flush) {
        flushersRef.current.set(taskId, flush)
        return
      }
      flushersRef.current.delete(taskId)
    },
    [],
  )

  function currentTaskValue(task: WorkOrderTask): string | null {
    if (draftValuesRef.current.has(task.id)) {
      return draftValuesRef.current.get(task.id) ?? null
    }
    return task.value ?? null
  }

  function handleLocalTaskChange(taskId: string, value: string | null) {
    draftValuesRef.current.set(taskId, value)
    setWorkOrder((current) => {
      if (!current) {
        return current
      }

      return {
        ...current,
        tasks: current.tasks.map((task) =>
          task.id === taskId ? { ...task, value } : task,
        ),
      }
    })
  }

  async function handleStart() {
    if (!workOrder) {
      return
    }

    setIsUpdatingStatus(true)
    setErrorMessage(null)
    setSuccessMessage(null)

    try {
      const updated = await updateWorkOrderStatus(workOrder.id, "InProgress")
      setWorkOrder(updated)
      setSuccessMessage(t("workOrders.execution.startedSuccess"))
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : t("workOrders.errors.updateStatusFailed"),
      )
    } finally {
      setIsUpdatingStatus(false)
    }
  }

  function handleQueued(taskId: string) {
    setPendingTaskIds((current) => {
      const next = new Set(current)
      next.add(taskId)
      return next
    })
  }

  function handlePersisted(next: WorkOrder, taskId: string) {
    for (const task of next.tasks) {
      const serverValue = task.value ?? null
      const draft = draftValuesRef.current.get(task.id)
      if (draft === undefined || draft === serverValue) {
        draftValuesRef.current.set(task.id, serverValue)
      }
    }
    hasWorkOrderRef.current = true
    setWorkOrder({
      ...next,
      tasks: next.tasks.map((task) => {
        const draft = draftValuesRef.current.get(task.id)
        if (draft !== undefined && draft !== (task.value ?? null)) {
          return { ...task, value: draft }
        }
        return task
      }),
    })
    setPendingTaskIds((current) => {
      if (!current.has(taskId)) {
        return current
      }

      const stillPending = new Set(current)
      stillPending.delete(taskId)
      return stillPending
    })
    void refreshSyncState()
  }

  async function flushPendingEdits(): Promise<void> {
    const pending: Array<Promise<unknown>> = []
    for (const flush of flushersRef.current.values()) {
      const result = flush()
      if (
        result != null &&
        typeof result === "object" &&
        "then" in result &&
        typeof result.then === "function"
      ) {
        pending.push(result as Promise<unknown>)
      }
    }
    await Promise.all(pending)
  }

  async function handleComplete() {
    if (!workOrder) {
      return
    }

    try {
      await flushPendingEdits()
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : t("workOrders.errors.updateTaskFailed"),
      )
      return
    }

    const missingMandatory = orderedTasks.filter((task) => {
      if (!task.isMandatory) {
        return false
      }

      return !isWorkOrderTaskFilled(task, currentTaskValue(task))
    })

    if (missingMandatory.length > 0) {
      setErrorMessage(
        t("workOrders.execution.mandatoryIncomplete", {
          tasks: missingMandatory.map((task) => task.title).join(", "),
        }),
      )
      return
    }

    setIsUpdatingStatus(true)
    setErrorMessage(null)
    setSuccessMessage(null)

    try {
      const updated = await updateWorkOrderStatus(workOrder.id, "Completed")
      setWorkOrder(updated)
      setSuccessMessage(t("workOrders.execution.completedSuccess"))
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : t("workOrders.errors.updateStatusFailed"),
      )
    } finally {
      setIsUpdatingStatus(false)
    }
  }

  const visibleConflicts = conflicts.filter(
    (conflict) => conflict.workOrderId === (workOrder?.id ?? id),
  )

  if (isLoading && workOrder === null) {
    return <PageContentSkeleton rows={5} />
  }

  if (!workOrder) {
    return (
      <div className="space-y-4">
        <WorkOrderOfflineBanner />
        <SyncConflictList
          conflicts={visibleConflicts}
          tasks={null}
          busyId={conflictBusyId}
          onDiscard={(conflict) => {
            void discardConflict(conflict)
          }}
          onRetry={(conflict) => {
            void retryConflict(conflict)
          }}
        />
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
        >
          {errorMessage ?? t("workOrders.errors.loadOneFailed")}
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            void navigate("/os")
          }}
        >
          <ArrowLeft data-icon="inline-start" />
          {t("workOrders.execution.back")}
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-28">
      <WorkOrderOfflineBanner />

      <SyncConflictList
        conflicts={visibleConflicts}
        tasks={workOrder.tasks}
        busyId={conflictBusyId}
        onDiscard={(conflict) => {
          void discardConflict(conflict)
        }}
        onRetry={(conflict) => {
          void retryConflict(conflict)
        }}
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              {t("workOrders.execution.title")}
            </h1>
            <Badge
              variant={
                workOrder.status === "Completed"
                  ? "success"
                  : workOrder.status === "InProgress"
                    ? "warning"
                    : "secondary"
              }
            >
              {t(`workOrders.status.${workOrder.status}`)}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {t("workOrders.execution.subtitle", {
              tag: workOrder.asset.tag,
              name: workOrder.asset.name,
            })}
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={() => {
            void navigate("/os")
          }}
        >
          <ArrowLeft data-icon="inline-start" />
          {t("workOrders.execution.back")}
        </Button>
      </div>

      <section className="grid gap-3 rounded-xl border border-border p-4 sm:grid-cols-2 sm:p-6">
        <div>
          <p className="text-xs text-muted-foreground">
            {t("workOrders.columns.asset")}
          </p>
          <p className="font-medium">
            {workOrder.asset.tag} — {workOrder.asset.name}
          </p>
          {workOrder.asset.location ? (
            <p className="text-sm text-muted-foreground">
              {workOrder.asset.location}
            </p>
          ) : null}
        </div>
        <div>
          <p className="text-xs text-muted-foreground">
            {t("workOrders.columns.scheduledDate")}
          </p>
          <p className="font-medium">
            {formatScheduledDate(workOrder.scheduledDate, i18n.language)}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">
            {t("workOrders.columns.origin")}
          </p>
          <p className="font-medium">
            <WorkOrderOrigin
              maintenancePlanId={workOrder.maintenancePlanId}
              sourcePlanName={workOrder.sourcePlanName}
            />
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">
            {t("workOrders.columns.id")}
          </p>
          <p className="font-mono text-sm">{workOrder.id}</p>
        </div>
        <div className="sm:col-span-2">
          <p className="text-xs text-muted-foreground">
            {t("workOrders.execution.notes")}
          </p>
          <p className="whitespace-pre-wrap font-medium">
            {workOrder.notes?.trim()
              ? workOrder.notes
              : t("workOrders.execution.noNotes")}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">
            {t("workOrders.execution.completedDate")}
          </p>
          <p className="font-medium">
            {workOrder.completedDate
              ? formatCompletedDate(workOrder.completedDate, i18n.language)
              : t("workOrders.execution.notCompleted")}
          </p>
        </div>
      </section>

      {successMessage !== null ? (
        <div
          role="status"
          className="rounded-lg border border-green-600/30 bg-green-600/10 p-4 text-green-900 dark:text-green-300"
        >
          <div className="flex items-start gap-3">
            <CircleCheck className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
            <p className="font-medium">{successMessage}</p>
          </div>
        </div>
      ) : null}

      {errorMessage !== null ? (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
        >
          {errorMessage}
        </div>
      ) : null}

      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-lg font-medium">
            {t("workOrders.execution.tasksTitle")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("workOrders.execution.tasksDescription")}
          </p>
        </div>

        <div className="space-y-4">
          {orderedTasks.map((task, index) => (
            <div
              key={task.id}
              className="space-y-3 rounded-xl border border-border bg-muted/20 p-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-medium">
                  {index + 1}. {task.title}
                </h3>
                {task.isMandatory ? (
                  <Badge variant="outline">
                    {t("workOrders.execution.mandatory")}
                  </Badge>
                ) : null}
                <Badge variant="secondary">
                  {t(`pmoc.inputType.${task.inputType}`)}
                </Badge>
              </div>

              <TaskField
                workOrderId={workOrder.id}
                task={task}
                disabled={isReadOnly}
                pendingSync={pendingTaskIds.has(task.id)}
                onLocalChange={handleLocalTaskChange}
                onPersisted={handlePersisted}
                onQueued={handleQueued}
                onError={setErrorMessage}
                onRegisterFlush={registerFlush}
              />
            </div>
          ))}
        </div>
      </section>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 p-4 sm:flex-row sm:justify-end">
          {workOrder.status === "Pending" ? (
            <LoadingButton
              type="button"
              loading={isUpdatingStatus}
              onClick={() => {
                void handleStart()
              }}
            >
              <Play data-icon="inline-start" />
              {t("workOrders.execution.start")}
            </LoadingButton>
          ) : null}

          {workOrder.status === "Pending" ||
          workOrder.status === "InProgress" ? (
            <LoadingButton
              type="button"
              variant="default"
              loading={isUpdatingStatus}
              onClick={() => {
                void handleComplete()
              }}
            >
              <CircleCheck data-icon="inline-start" />
              {t("workOrders.execution.complete")}
            </LoadingButton>
          ) : null}
        </div>
      </div>
    </div>
  )
}
