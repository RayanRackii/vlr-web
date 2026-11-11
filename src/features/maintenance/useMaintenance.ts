import { useTenantTimeZone } from "@/contexts/TenantTimeZoneContext"
import { tenantTodayIsoDate } from "@/lib/tenantTimeZone"
import { formatWorkOrderShortId } from "@/features/workOrders/lib/workOrderLabel"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { usePermissions } from "@/features/users/permissions/PermissionContext"
import type { MaintenancePlan } from "@/features/pmoc/schemas/maintenancePlanSchemas"
import type { WorkOrder } from "@/features/workOrders/schemas/workOrderSchemas"
import { getPlans } from "@/features/pmoc/services/pmocService"
import { getWorkOrders } from "@/features/workOrders/services/workOrdersService"

export function useMaintenanceAccess() {
  const { can, activeModules, isLoading, currentUser } = usePermissions()
  const pmoc = !isLoading && activeModules.includes("pmoc")
  const os = !isLoading && activeModules.includes("os")
  return {
    isLoading, scope: currentUser?.tenantId ?? "",
    plans: pmoc && can("pmoc.plans.read"), library: pmoc && can("pmoc.templates.read"),
    orders: os && can("os.work_orders.read"),
    createPlan: pmoc && can("pmoc.plans.write"), createOrder: os && can("os.work_orders.create"),
  }
}

export function useMaintenance() {
  const access = useMaintenanceAccess()
  const { t } = useTranslation()
  const [revision, setRevision] = useState(0)
  const requestKey = `${access.scope}:${access.plans}:${access.orders}:${revision}`
  const [state, setState] = useState<{ key: string; plans: MaintenancePlan[]; orders: WorkOrder[]; errors: string[] }>({ key: "", plans: [], orders: [], errors: [] })
  useEffect(() => {
    let cancelled = false
    void Promise.allSettled([
      access.plans ? getPlans() : Promise.resolve([] as MaintenancePlan[]),
      access.orders ? getWorkOrders() : Promise.resolve([] as WorkOrder[]),
    ]).then(([plans, orders]) => {
      if (cancelled) return
      const errors = [plans, orders].flatMap(result => result.status === "rejected" ? [result.reason instanceof Error ? result.reason.message : t("maintenance.loadError")] : [])
      setState({ key: requestKey, plans: plans.status === "fulfilled" ? plans.value : [], orders: orders.status === "fulfilled" ? orders.value : [], errors })
    })
    return () => { cancelled = true }
  }, [requestKey, access.plans, access.orders, t])
  const ready = state.key === requestKey
  return {
    access, plans: ready && access.plans ? state.plans : [], orders: ready && access.orders ? state.orders : [],
    errors: ready ? state.errors : [], loading: access.isLoading || !ready,
    retry: () => setRevision(value => value + 1),
  }
}

export type MaintenanceTab = "hoje" | "ordens" | "planos"
type Row = { id: string; kind: "planos" | "ordens"; title: string; status: string; statusLabel: string; date: string; description: string; to: string; generate?: string }

export function useMaintenanceList(data: ReturnType<typeof useMaintenance>, { tab, search, status, kind }: { tab: MaintenanceTab; search: string; status: string; kind: string }) {
  const { t, i18n } = useTranslation()
  const timeZone = useTenantTimeZone()
  const today = tenantTodayIsoDate(timeZone)
  const rows: Row[] = [
    ...(tab !== "ordens" ? data.plans.filter(plan => tab !== "hoje" || (plan.isActive && plan.firstDueDate <= today)).map(plan => ({
      id: `plan-${plan.id}`, kind: "planos" as const, title: plan.name,
      status: tab === "hoje" ? "due" : plan.isActive ? "active" : "inactive",
      statusLabel: tab === "hoje" ? t("maintenance.due") : t(`pmoc.plans.status.${plan.isActive ? "active" : "inactive"}`),
      date: plan.firstDueDate, description: [t("maintenance.firstDue", { date: plan.firstDueDate }), plan.description].filter(Boolean).join(" · "),
      to: `/pmoc/${plan.id}`, generate: plan.isActive && data.access.createOrder ? `/manutencao/ordens/nova?plano=${plan.id}` : undefined,
    })) : []),
    ...(tab !== "planos" ? data.orders.filter(order => tab !== "hoje" || !["Completed", "Canceled"].includes(order.status)).map(order => ({
      id: `order-${order.id}`, kind: "ordens" as const, title: `${formatWorkOrderShortId(order.id)} · ${order.asset.tag} — ${order.asset.name}`,
      status: order.status, statusLabel: t(`workOrders.status.${order.status}`), date: order.scheduledDate,
      description: [order.scheduledDate, order.sourcePlanName, order.assignedUser?.fullName].filter(Boolean).join(" · "), to: `/os/${order.id}`,
    })) : []),
  ].sort((a, b) => a.date.localeCompare(b.date))
  const statusOptions = [...new Map(rows.map(row => [row.status, row.statusLabel])).entries()]
  const query = search.trim().toLocaleLowerCase(i18n.language)
  const filtered = rows.filter(row => (!status || row.status === status) && (!kind || row.kind === kind) && `${row.title} ${row.description} ${row.statusLabel}`.toLocaleLowerCase(i18n.language).includes(query))
  return { filtered, statusOptions }
}
