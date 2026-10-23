import { CheckCircle2, Circle } from "lucide-react"
import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"

import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card"
import type { RentalsReadiness } from "@/features/rentals/schemas/rentalsReadinessSchemas"
import { getRentalsReadiness } from "@/features/rentals/services/rentalsReadinessService"
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
  const canView = activeModules.includes("rentals") && can("rentals.assets.read")

  useEffect(() => {
    if (!canView) {
      return
    }

    let cancelled = false

    void getRentalsReadiness()
      .then((data) => {
        if (!cancelled) {
          setReadiness(data)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setReadiness(null)
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
        <h2 className="text-base font-medium text-muted-foreground">{t("dashboard.rentalsReadiness.title")}</h2>
        <CardDescription>{t("dashboard.rentalsReadiness.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {readiness.items.map((item) => {
            const Icon = item.done ? CheckCircle2 : Circle
            const label = t(`dashboard.rentalsReadiness.items.${item.key}`)

            return (
              <li key={item.key} className="flex items-center gap-2 text-sm">
                <Icon
                  aria-hidden="true"
                  className={item.done ? "size-4 text-emerald-600" : "size-4 text-muted-foreground"}
                />
                <Link className="underline underline-offset-4" to={READINESS_LINKS[item.key]}>
                  {label}
                </Link>
                {item.count !== undefined ? (
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
