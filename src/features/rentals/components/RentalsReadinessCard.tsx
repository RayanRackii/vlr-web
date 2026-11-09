import { CheckCircle2, Circle } from "lucide-react"
import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"

import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card"
import {
  pendingPortalChecks,
  type PortalReadinessCheck,
} from "@/features/dashboard/lib/portalReadiness"
import {
  getCatalogProductAccess,
  listCatalogProducts,
  listCustomerGroups,
} from "@/features/catalog/services/catalogService"
import {
  getRentalsReadiness,
  type RentalsReadiness,
} from "@/features/rentals/services/rentalsReadinessService"
import { listAdminRentalAssets } from "@/features/rentals/services/scheduleService"
import { listTenantModuleMenuItems } from "@/features/tenantPortal/services/tenantPortalService"
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
  const [portalChecks, setPortalChecks] = useState<PortalReadinessCheck[]>([])
  const canView = activeModules.includes("rentals") && can("rentals.assets.read")
  const canReadMenu = can("core.module_menu.read")
  const canReadCatalog = activeModules.includes("catalog") && can("catalog.products.read")

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

  useEffect(() => {
    if (!canReadMenu && !canReadCatalog) {
      return
    }

    let cancelled = false
    void (async () => {
      const [menuItems, products, groups] = await Promise.all([
        canReadMenu ? listTenantModuleMenuItems().catch(() => null) : Promise.resolve(null),
        canReadCatalog ? listCatalogProducts().catch(() => []) : Promise.resolve([]),
        canReadCatalog ? listCustomerGroups().catch(() => []) : Promise.resolve([]),
      ])
      const restricted = products.filter((product) => product.visibility === "Restricted")
      const accessEntries = await Promise.all(restricted.map(async (product) => {
        try {
          return [product.id, await getCatalogProductAccess(product.id)] as const
        } catch {
          return [product.id, null] as const
        }
      }))
      if (cancelled) {
        return
      }
      setPortalChecks(pendingPortalChecks({
        activeModules,
        menuItems,
        products,
        groups,
        accessByProductId: Object.fromEntries(accessEntries),
      }))
    })()

    return () => {
      cancelled = true
    }
  }, [activeModules, canReadCatalog, canReadMenu])

  const showRentals = Boolean(canView && readiness && !readiness.ready)
  if (!showRentals && portalChecks.length === 0) {
    return null
  }

  return (
    <Card className="min-w-0">
      <CardHeader>
        <h2 className="text-base font-medium text-foreground">
          {t(showRentals ? "dashboard.rentalsReadiness.title" : "dashboard.portalReadiness.title")}
        </h2>
        <CardDescription>
          {t(showRentals ? "dashboard.rentalsReadiness.description" : "dashboard.portalReadiness.description")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {showRentals && readiness && readiness.items.map((item) => {
            const Icon = item.done ? CheckCircle2 : Circle
            const label = t(`dashboard.rentalsReadiness.items.${item.key}`)
            const status = t(`dashboard.rentalsReadiness.status.${item.done ? "done" : "pending"}`)

            return (
              <li key={item.key} className="flex min-w-0 items-center gap-2 text-sm">
                <Icon
                  aria-hidden="true"
                  className={
                    item.done
                      ? "size-4 shrink-0 text-[color-mix(in_oklch,var(--success)_70%,var(--foreground))]"
                      : "size-4 shrink-0 text-muted-foreground"
                  }
                />
                <span className="sr-only">{status}</span>
                <Link className="inline-flex min-h-11 min-w-11 flex-1 items-center underline underline-offset-4 [overflow-wrap:anywhere]" to={READINESS_LINKS[item.key]}>
                  {label}
                </Link>
                {item.count !== undefined &&
                !(item.key === "hasScheduleTemplateOrRule" && hasOnlyOpenHoursResources) ? (
                  <span className="text-muted-foreground">({item.count})</span>
                ) : null}
              </li>
            )
          })}
          {portalChecks.map((item) => (
            <li key={item.key} className="flex min-w-0 items-center gap-2 text-sm">
              <Circle aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
              <span className="sr-only">{t("dashboard.rentalsReadiness.status.pending")}</span>
              <Link className="inline-flex min-h-11 min-w-11 flex-1 items-center underline underline-offset-4 [overflow-wrap:anywhere]" to={item.href}>
                {t(`dashboard.portalReadiness.items.${item.key}`)}
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
