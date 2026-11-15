import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { zonedDayAndMinutes } from "@/features/catalog/components/agenda/agendaLayout"
import type { CatalogOrder } from "@/features/catalog/schemas/catalogSchemas"
import { applyCatalogOrderAllocationUsage } from "@/features/catalog/services/catalogService"
import { usePermissions } from "@/features/users/permissions/PermissionContext"

function resourceAgendaPath(plannedWorkStart: string, timeZoneId: string): string {
  const day = zonedDayAndMinutes(plannedWorkStart, timeZoneId)?.dayKey
  return day ? `/agendas/recursos?date=${day}` : "/agendas/recursos"
}

/** The allocation (resource booking) of the first allocated order item, if any. */
export function findOrderAllocation(order: CatalogOrder | null) {
  return order?.items.find((item) => item.allocation != null)?.allocation ?? null
}

export type OrderAllocation = NonNullable<ReturnType<typeof findOrderAllocation>>

/**
 * Resource-usage transitions (work finished / release) for an order allocation.
 * The page header owns the buttons; the mutation and its error handling live here.
 */
export function useAllocationUsage(
  order: CatalogOrder | null,
  onOrderChange: (order: CatalogOrder) => void,
) {
  const { t } = useTranslation()
  const { can } = usePermissions()
  const allocation = findOrderAllocation(order)
  const [busyAction, setBusyAction] = useState<"work-finished" | "release" | null>(null)
  const canAllocate = can("catalog.orders.allocate") && can("catalog.orders.manage")

  async function runUsage(action: "work-finished" | "release") {
    if (!order || !allocation) {
      return
    }
    setBusyAction(action)
    try {
      const next = await applyCatalogOrderAllocationUsage(
        order.id,
        allocation.id,
        action,
        allocation.planningRevision,
      )
      onOrderChange(next)
      toast.success(t("catalog.resourcePlanning.activeUse.toastUpdated"))
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("catalog.resourcePlanning.errors.usageActionFailed"),
      )
    } finally {
      setBusyAction(null)
    }
  }

  return {
    allocation,
    busyAction,
    runUsage,
    canFinish: canAllocate && allocation?.status === "Running",
    canRelease: canAllocate && allocation?.status === "Cleaning",
  }
}

/** Resource agenda link for an allocation (day of the planned work start). */
export function allocationAgendaPath(allocation: OrderAllocation): string {
  return resourceAgendaPath(allocation.plannedWorkStart, allocation.timeZoneId)
}
