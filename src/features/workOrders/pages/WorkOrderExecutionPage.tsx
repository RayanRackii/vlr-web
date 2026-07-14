import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import {
  ArrowLeft,
  CircleCheck,
  LoaderCircle,
  Play,
  WifiOff,
} from "lucide-react"
import { useTranslation } from "react-i18next"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/contexts/AuthContext"
import {
  parseNumberConfiguration,
  parseSingleChoiceConfiguration,
  type WorkOrder,
  type WorkOrderTask,
} from "@/features/workOrders/schemas/workOrderSchemas"
import {
  getWorkOrderById,
  updateTaskValue,
  updateWorkOrderStatus,
} from "@/features/workOrders/services/workOrdersService"
import { useDebouncedCallback } from "@/hooks/useDebouncedCallback"
import { isAxiosError } from "@/lib/api"
import { processSyncQueue } from "@/lib/offlineSync"

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

function TaskField({
  workOrderId,
  task,
  disabled,
  onLocalChange,
  onPersisted,
  onError,
}: {
  workOrderId: string
  task: WorkOrderTask
  disabled: boolean
  onLocalChange: (taskId: string, value: string | null) => void
  onPersisted: (workOrder: WorkOrder) => void
  onError: (message: string) => void
}) {
  const { t } = useTranslation()

  const persistValue = useCallback(
    async (value: string | null) => {
      try {
        const updated = await updateTaskValue(workOrderId, task.id, value)
        if (updated !== null) {
          onPersisted(updated)
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
    [onError, onPersisted, t, task.id, workOrderId],
  )

  const debouncedPersist = useDebouncedCallback(
    (value: string | null) => {
      void persistValue(value)
    },
    400,
  )

  const numberConfig = useMemo(
    () => parseNumberConfiguration(task.configuration),
    [task.configuration],
  )

  const choiceConfig = useMemo(
    () => parseSingleChoiceConfiguration(task.configuration),
    [task.configuration],
  )

  const choiceItems = useMemo(
    () =>
      (choiceConfig?.options ?? []).map((option) => ({
        value: option,
        label: option,
      })),
    [choiceConfig],
  )

  switch (task.inputType) {
    case "Checkbox": {
      const checked = task.value === "true"

      return (
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
      )
    }

    case "Text":
      return (
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
        </div>
      )

    case "SingleChoice":
      return (
        <Select
          modal={false}
          disabled={disabled}
          value={task.value ?? undefined}
          onValueChange={(value) => {
            const nextValue = value ?? null
            onLocalChange(task.id, nextValue)
            void persistValue(nextValue)
          }}
          items={choiceItems}
        >
          <SelectTrigger className="w-full">
            <SelectValue
              placeholder={t("workOrders.execution.choicePlaceholder")}
            />
          </SelectTrigger>
          <SelectContent>
            {(choiceConfig?.options ?? []).map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )

    case "Image":
      return (
        <Button type="button" variant="outline" disabled>
          {t("workOrders.execution.imageUploadSoon")}
        </Button>
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
  const [isOffline, setIsOffline] = useState(
    () => typeof navigator !== "undefined" && !navigator.onLine,
  )

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

    setIsLoading(true)
    setErrorMessage(null)

    try {
      const data = await getWorkOrderById(id)
      setWorkOrder(data)
    } catch (error: unknown) {
      console.error("WorkOrderExecutionPage loadWorkOrder failed", error)
      if (isAxiosError(error)) {
        console.error(
          "WorkOrderExecutionPage loadWorkOrder response",
          error.response?.data,
        )
      }

      setErrorMessage(
        error instanceof Error
          ? error.message
          : t("workOrders.errors.loadOneFailed"),
      )
    } finally {
      setIsLoading(false)
    }
  }, [id, session, t])

  useEffect(() => {
    void loadWorkOrder()
  }, [loadWorkOrder])

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false)
      void processSyncQueue().catch((error: unknown) => {
        console.error("WorkOrderExecutionPage processSyncQueue failed", error)
      })
    }

    const handleOffline = () => {
      setIsOffline(true)
    }

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    if (navigator.onLine) {
      void processSyncQueue().catch((error: unknown) => {
        console.error(
          "WorkOrderExecutionPage initial processSyncQueue failed",
          error,
        )
      })
    }

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [])

  const isReadOnly =
    workOrder?.status === "Completed" || workOrder?.status === "Canceled"

  const orderedTasks = useMemo(() => {
    if (!workOrder) {
      return []
    }

    return [...workOrder.tasks].sort((a, b) => a.order - b.order)
  }, [workOrder])

  function handleLocalTaskChange(taskId: string, value: string | null) {
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

  async function handleComplete() {
    if (!workOrder) {
      return
    }

    const missingMandatory = orderedTasks.filter(
      (task) => task.isMandatory && (task.value == null || task.value.trim() === ""),
    )

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

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <LoaderCircle className="size-4 animate-spin" />
        {t("workOrders.execution.loading")}
      </div>
    )
  }

  if (!workOrder) {
    return (
      <div className="space-y-4">
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
      {isOffline ? (
        <Alert variant="warning">
          <WifiOff aria-hidden="true" />
          <AlertTitle>{t("workOrders.offline.title")}</AlertTitle>
          <AlertDescription>
            {t("workOrders.offline.banner")}
          </AlertDescription>
        </Alert>
      ) : null}

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
            {workOrder.maintenancePlanId
              ? t("workOrders.origin.pmoc")
              : t("workOrders.origin.manual")}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">
            {t("workOrders.columns.id")}
          </p>
          <p className="font-mono text-sm">{workOrder.id}</p>
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
          {orderedTasks.map((task) => (
            <div
              key={task.id}
              className="space-y-3 rounded-xl border border-border bg-muted/20 p-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-medium">
                  {task.order}. {task.title}
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
                onLocalChange={handleLocalTaskChange}
                onPersisted={setWorkOrder}
                onError={setErrorMessage}
              />
            </div>
          ))}
        </div>
      </section>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 p-4 sm:flex-row sm:justify-end">
          {workOrder.status === "Pending" ? (
            <Button
              type="button"
              disabled={isUpdatingStatus}
              onClick={() => {
                void handleStart()
              }}
            >
              {isUpdatingStatus ? (
                <LoaderCircle
                  data-icon="inline-start"
                  className="animate-spin"
                />
              ) : (
                <Play data-icon="inline-start" />
              )}
              {t("workOrders.execution.start")}
            </Button>
          ) : null}

          {workOrder.status === "Pending" ||
          workOrder.status === "InProgress" ? (
            <Button
              type="button"
              variant="default"
              disabled={isUpdatingStatus}
              onClick={() => {
                void handleComplete()
              }}
            >
              {isUpdatingStatus ? (
                <LoaderCircle
                  data-icon="inline-start"
                  className="animate-spin"
                />
              ) : (
                <CircleCheck data-icon="inline-start" />
              )}
              {t("workOrders.execution.complete")}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
