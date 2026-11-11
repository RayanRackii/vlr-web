import { useEffect, useState } from "react"
import { Outlet, useSearchParams } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { AccessDeniedPage } from "@/components/layout/AccessDeniedPage"
import { PageContentSkeleton } from "@/components/loading/PageContentSkeleton"
import { Button } from "@/components/ui/button"
import { CreatePlanPage } from "@/features/pmoc/pages/CreatePlanPage"
import { getPlan } from "@/features/pmoc/services/pmocService"
import type { MaintenancePlan } from "@/features/pmoc/schemas/maintenancePlanSchemas"
import { CreateWorkOrderPage } from "@/features/workOrders/pages/CreateWorkOrderPage"
import { useMaintenanceAccess } from "./useMaintenance"
import "./maintenance.css"

export function MaintenanceRoute() {
  const access = useMaintenanceAccess()
  if (access.isLoading) return <PageContentSkeleton />
  if (!access.plans && !access.orders && !access.library) return <AccessDeniedPage />
  return <Outlet />
}

export function MaintenanceCreatePlanPage() {
  const access = useMaintenanceAccess()
  return <div className="maintenance-page maintenance-form mx-auto min-w-0 space-y-5"><CreatePlanPage key={access.scope} maintenance /></div>
}

function PlanOrderForm({ planId }: { planId: string }) {
  const { t } = useTranslation()
  const [plan, setPlan] = useState<MaintenancePlan | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    let cancelled = false
    void getPlan(planId).then(value => {
      if (cancelled) return
      if (!value.isActive) { setError(t("maintenance.planUnavailable")); return }
      setPlan(value)
    }).catch((reason: unknown) => {
      if (!cancelled) setError(reason instanceof Error ? reason.message : t("maintenance.loadError"))
    })
    return () => { cancelled = true }
  }, [planId, revision, t])
  if (error) return <div className="maintenance-page mx-auto space-y-5"><h1 className="text-xl font-semibold sm:text-2xl">{t("maintenance.generate")}</h1><div role="alert">{error}</div><Button variant="outline" onClick={() => { setError(null); setPlan(null); setRevision(value => value + 1) }}>{t("catalog.retry")}</Button></div>
  if (!plan) return <PageContentSkeleton />
  return <CreateWorkOrderPage maintenance sourcePlan={plan} />
}

export function MaintenanceCreateOrderPage() {
  const [params] = useSearchParams()
  const access = useMaintenanceAccess()
  const planId = params.get("plano")
  if (planId && !access.plans) return <AccessDeniedPage />
  return <div className="maintenance-page maintenance-form mx-auto min-w-0 space-y-5">
    {planId ? <PlanOrderForm key={`${access.scope}:${planId}`} planId={planId} /> : <CreateWorkOrderPage key={access.scope} maintenance />}
  </div>
}
