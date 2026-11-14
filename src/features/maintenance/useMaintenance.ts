import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { usePermissions } from "@/features/users/permissions/PermissionContext"
import type { MaintenancePlan } from "@/features/pmoc/schemas/maintenancePlanSchemas"
import type { WorkOrder } from "@/features/workOrders/schemas/workOrderSchemas"
import type { MaintenancePlanCoverage } from "@/features/pmoc/schemas/coverageSchemas"
import { getPlanCoverage, getPlans } from "@/features/pmoc/services/pmocService"
import { getWorkOrders } from "@/features/workOrders/services/workOrdersService"

const MAX_COVERAGE_PLANS = 50
const COVERAGE_BATCH = 6

export function useMaintenanceAccess() {
  const { can, activeModules, isLoading, currentUser } = usePermissions()
  const pmoc = !isLoading && activeModules.includes("pmoc")
  const os = !isLoading && activeModules.includes("os")
  return {
    isLoading, scope: currentUser?.tenantId ?? "", userId: currentUser?.id ?? null,
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
  const [coverageState, setCoverageState] = useState<{ key: string; data: Record<string, MaintenancePlanCoverage>; failed: number }>({ key: "", data: {}, failed: 0 })
  useEffect(() => {
    if (state.key !== requestKey || !access.plans) return
    let cancelled = false
    const targets = state.plans.filter(plan => plan.isActive).slice(0, MAX_COVERAGE_PLANS)
    void (async () => {
      const data: Record<string, MaintenancePlanCoverage> = {}
      let failed = 0
      for (let index = 0; index < targets.length; index += COVERAGE_BATCH) {
        const batch = targets.slice(index, index + COVERAGE_BATCH)
        const results = await Promise.allSettled(batch.map(plan => getPlanCoverage(plan.id)))
        results.forEach((result, position) => {
          if (result.status === "fulfilled") data[batch[position].id] = result.value
          else failed += 1
        })
        if (cancelled) return
      }
      if (!cancelled) setCoverageState({ key: requestKey, data, failed })
    })()
    return () => { cancelled = true }
  }, [state, requestKey, access.plans])
  const coverageReady = !access.plans || (ready && coverageState.key === requestKey)
  return {
    coverage: coverageReady && access.plans ? coverageState.data : {}, coverageFailed: coverageReady ? coverageState.failed : 0,
    coverageLoading: !coverageReady, access, plans: ready && access.plans ? state.plans : [], orders: ready && access.orders ? state.orders : [],
    errors: ready ? state.errors : [], loading: access.isLoading || !ready,
    retry: () => setRevision(value => value + 1),
  }
}

export type MaintenanceTab = "agenda" | "ordens" | "planos"
