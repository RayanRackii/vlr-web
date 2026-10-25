import { CheckCircle2, Circle } from "lucide-react"
import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"

import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card"
import {
  getRentalsReadiness,
  type RentalsReadiness,
} from "@/features/rentals/services/rentalsReadinessService"
import { listAdminRentalAssets } from "@/features/rentals/services/scheduleService"
import { usePermissions } from "@/features/users/permissions/PermissionContext"

const READINESS_LINKS = {
  hasUnits: "/configuracoes/recursos",
  hasRentableAssets: "/configuracoes/recursos",
  hasScheduleTemplateOrRule: "/configuracoes/agenda",
  hasBookingPolicy: "/configuracoes/politica-reservas",
  hasVisualOrMap: "/configuracoes/layout",
} as const

export function RentalsReadinessCard() {
  const { t } = useTranslation()
  const { activeModules, can } = usePermissions()
  const [readiness, setReadiness] = useState<RentalsReadiness | null>(null)
  const [hasOnlyOpenHoursResources, setHasOnlyOpenHoursResources] = useState(false)
  const canView = activeModules.includes("rentals") && can("rentals.assets.read")

  useEffect(() => {
    if (!canView) {
      return
    }

    let cancelled = false

    void Promise.all([
      getRentalsReadiness(),
      listAdminRentalAssets().catch(() => null),
    ])
      .then(([data, assets]) => {
        if (!cancelled) {
          setReadiness(data)
          const activeAssets = assets?.filter((asset) => asset.isActive) ?? []
          setHasOnlyOpenHoursResources(
            activeAssets.length > 0 &&
              activeAssets.every((asset) => asset.schedulePolicy === "OpenHours"),
          )
        }
      })
      .catch(() => {
        if (!cancelled) {
          setReadiness(null)
          setHasOnlyOpenHoursResources(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [canView])

  if (!canView || !readiness || readiness.ready) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <h2 className="text-base font-medium text-foreground">{t("dashboard.rentalsReadiness.title")}</h2>
        <CardDescription>{t("dashboard.rentalsReadiness.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {readiness.items.map((item) => {
            const Icon = item.done ? CheckCircle2 : Circle
            const label = t(`dashboard.rentalsReadiness.items.${item.key}`)
            const status = t(`dashboard.rentalsReadiness.status.${item.done ? "done" : "pending"}`)

            return (
              <li key={item.key} className="flex items-center gap-2 text-sm">
                <Icon
                  aria-hidden="true"
                  className={
                    item.done
                      ? "size-4 text-[color-mix(in_oklch,var(--success)_70%,var(--foreground))]"
                      : "size-4 text-muted-foreground"
                  }
                />
                <span className="sr-only">{status}</span>
                <Link className="underline underline-offset-4" to={READINESS_LINKS[item.key]}>
                  {label}
                </Link>
                {item.count !== undefined &&
                !(item.key === "hasScheduleTemplateOrRule" && hasOnlyOpenHoursResources) ? (
                  <span className="text-muted-foreground">({item.count})</span>
                ) : null}
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}
