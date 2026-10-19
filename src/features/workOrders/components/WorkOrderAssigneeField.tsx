import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { TechnicianUser } from "@/features/users/schemas/userSchemas"
import { getTechnicians } from "@/features/users/services/usersService"
import { usePermissions } from "@/features/users/permissions/PermissionContext"
import { describeApiError } from "@/features/users/permissions/rbacErrors"
import type { WorkOrder } from "@/features/workOrders/schemas/workOrderSchemas"
import { updateWorkOrderAssignee } from "@/features/workOrders/services/workOrdersService"

const UNASSIGNED_VALUE = "unassigned"

type WorkOrderAssigneeFieldProps = {
  workOrder: WorkOrder
  onUpdated: (workOrder: WorkOrder) => void
}

export function WorkOrderAssigneeField({
  workOrder,
  onUpdated,
}: WorkOrderAssigneeFieldProps) {
  const { t } = useTranslation()
  const { can } = usePermissions()
  const canAssign = can("os.work_orders.assign")
  const isClosed =
    workOrder.status === "Completed" || workOrder.status === "Canceled"
  const [technicians, setTechnicians] = useState<TechnicianUser[] | null>(null)
  const [techniciansError, setTechniciansError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    if (!canAssign || isClosed) {
      return
    }

    let cancelled = false
    setTechnicians(null)
    setTechniciansError(null)

    void getTechnicians()
      .then((list) => {
        if (!cancelled) {
          setTechnicians(list)
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setTechnicians([])
          setTechniciansError(
            describeApiError(error, t("users.errors.loadTechnicians")),
          )
        }
      })

    return () => {
      cancelled = true
    }
  }, [canAssign, isClosed, t, workOrder.id])

  const currentName =
    workOrder.assignedUser?.fullName ?? t("workOrders.create.form.unassigned")

  const technicianItems = useMemo(() => {
    const byId = new Map<string, TechnicianUser>()
    for (const technician of technicians ?? []) {
      byId.set(technician.id, technician)
    }

    if (
      workOrder.assignedUser != null &&
      !byId.has(workOrder.assignedUser.id)
    ) {
      byId.set(workOrder.assignedUser.id, {
        id: workOrder.assignedUser.id,
        fullName: workOrder.assignedUser.fullName,
        email: workOrder.assignedUser.email,
      })
    }

    return [...byId.values()]
  }, [technicians, workOrder.assignedUser])

  async function handleChange(value: string | null) {
    const nextId = value === UNASSIGNED_VALUE || value == null ? null : value
    if (nextId === (workOrder.assignedUserId ?? null)) {
      return
    }

    setIsSaving(true)
    setSaveError(null)

    try {
      const updated = await updateWorkOrderAssignee(workOrder.id, nextId)
      onUpdated(updated)
      toast.success(
        nextId === null
          ? t("workOrders.execution.assigneeCleared")
          : t("workOrders.execution.assigneeUpdated"),
      )
    } catch (error: unknown) {
      setSaveError(
        describeApiError(error, t("workOrders.errors.assignFailed")),
      )
    } finally {
      setIsSaving(false)
    }
  }

  const showSelector =
    canAssign && !isClosed && techniciansError === null && technicians !== null

  return (
    <div>
      <p className="text-xs text-muted-foreground">
        {t("workOrders.columns.assignee")}
      </p>
      {showSelector ? (
        <Select
          modal={false}
          value={workOrder.assignedUserId ?? UNASSIGNED_VALUE}
          onValueChange={(value) => {
            void handleChange(value)
          }}
          items={[
            {
              value: UNASSIGNED_VALUE,
              label: t("workOrders.create.form.unassigned"),
            },
            ...technicianItems.map((technician) => ({
              value: technician.id,
              label: technician.fullName,
            })),
          ]}
          disabled={isSaving}
        >
          <SelectTrigger
            className="mt-1 w-full"
            aria-label={t("workOrders.columns.assignee")}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={UNASSIGNED_VALUE}>
              {t("workOrders.create.form.unassigned")}
            </SelectItem>
            {technicianItems.map((technician) => (
              <SelectItem key={technician.id} value={technician.id}>
                {technician.fullName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <p className="font-medium">
          {canAssign &&
          !isClosed &&
          technicians === null &&
          techniciansError === null
            ? t("workOrders.execution.assigneeLoading")
            : currentName}
        </p>
      )}
      {techniciansError !== null && canAssign && !isClosed ? (
        <p className="mt-1 text-sm text-muted-foreground" role="status">
          {techniciansError}
        </p>
      ) : null}
      {saveError !== null ? (
        <p className="mt-1 text-sm text-destructive" role="alert">
          {saveError}
        </p>
      ) : null}
    </div>
  )
}
