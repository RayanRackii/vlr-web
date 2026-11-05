import { useCallback, useEffect, useState } from "react"
import { Boxes, Pencil, DoorOpen, Package, Plus } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { ErrorState } from "@/components/ErrorState"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ICON_STROKE_WIDTH } from "@/lib/icon"
import { RentalResourceDetails } from "@/features/rentals/components/RentalResourceDetails"
import { ScheduleEmptyState } from "@/features/rentals/components/schedule/ScheduleEmptyState"
import { getAssetPricings, type RentalPricing } from "@/features/assets/services/rentalPricingService"
import {
  listAdminRentalAssets,
  type AdminRentalAsset,
} from "@/features/rentals/services/scheduleService"
import { useTrialStatus } from "@/features/users/hooks/useTrialStatus"
import { Can } from "@/features/users/permissions/Can"
import { usePermissions } from "@/features/users/permissions/PermissionContext"
import { mapRbacErrorMessage } from "@/features/users/permissions/rbacErrors"

type ResourcePrice = Pick<RentalPricing, "pricePerHour" | "pricingUnit">

export function RentalResourcesPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { can } = usePermissions()
  const { isTrialReadOnly } = useTrialStatus()

  const [assets, setAssets] = useState<AdminRentalAsset[]>([])
  const [priceByAssetId, setPriceByAssetId] = useState<Record<string, ResourcePrice>>({})
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const canWrite = can("rentals.assets.write") && !isTrialReadOnly
  const canReadPricing = can("rentals.pricing.read")
  const spaceCount = assets.filter((asset) => asset.type === "Location").length

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const assetList = await listAdminRentalAssets()
      setAssets(assetList)
      if (canReadPricing) {
        const prices = await Promise.all(assetList.map(async (asset) => {
          try {
            const pricings = await getAssetPricings(asset.assetId)
            const lowestPrice = pricings.filter((pricing) => pricing.pricePerHour > 0).reduce<RentalPricing | null>(
              (lowest, pricing) => lowest === null || pricing.pricePerHour < lowest.pricePerHour ? pricing : lowest,
              null,
            )
            return lowestPrice === null ? null : [asset.assetId, { pricePerHour: lowestPrice.pricePerHour, pricingUnit: lowestPrice.pricingUnit }] as const
          } catch {
            return null
          }
        }))
        setPriceByAssetId(Object.fromEntries(prices.filter((price): price is readonly [string, ResourcePrice] => price !== null)))
      } else {
        setPriceByAssetId({})
      }
    } catch (error) {
      const fallback = t("rentals.resources.loadError")
      const raw =
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : fallback
      const message = mapRbacErrorMessage(raw, fallback)
      setLoadError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [canReadPricing, t])

  useEffect(() => {
    let current = true
    void Promise.resolve().then(() => { if (current) return load() })
    return () => { current = false }
  }, [load])

  function openCreate() {
    navigate("/configuracoes/recursos/novo")
  }

  function openEdit(asset: AdminRentalAsset) {
    navigate(`/configuracoes/recursos/${encodeURIComponent(asset.id)}`)
  }

  return (
    <div className="rental-resources">
      <header className="resources-header">
        <div>
          <p className="resources-eyebrow">{t("rentals.resources.eyebrow")}</p>
          <h1>{t("rentals.resources.title")}</h1>
          <p className="resources-description">{t("rentals.resources.description")}</p>
        </div>
          <Can permission="rentals.assets.write">
            <Button
              type="button"
              disabled={!canWrite || loading || loadError !== null}
              onClick={openCreate}
            >
              <Plus data-icon="inline-start" strokeWidth={ICON_STROKE_WIDTH} />
              {t("rentals.resources.add")}
            </Button>
          </Can>
      </header>

      {loading ? (
        <div className="resources-card resources-skeleton" role="status" aria-busy="true" aria-label={t("common.loading")}>
          <span className="sr-only">{t("common.loading")}</span>
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="resource-skeleton-row" aria-hidden="true">
              <Skeleton className="size-[42px] shrink-0 rounded-xl" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-48 max-w-full" />
                <Skeleton className="h-3 w-64 max-w-full" />
              </div>
              <Skeleton className="h-4 w-20 shrink-0" />
            </div>
          ))}
        </div>
      ) : loadError !== null ? (
        <ErrorState message={loadError} onRetry={() => void load()} />
      ) : assets.length === 0 ? (
        <ScheduleEmptyState
          className="resources-card resources-empty"
          icon={Boxes}
          title={t("rentals.resources.emptyTitle")}
          description={t("rentals.resources.emptyDescription")}
          actionLabel={canWrite ? t("rentals.resources.add") : undefined}
          onAction={canWrite ? openCreate : undefined}
        />
      ) : (
        <section className="resources-card" aria-label={t("rentals.resources.title")}>
          <div className="resources-summary">
            <p>
              <strong>{t("rentals.resources.summaryResources", { count: assets.length })}</strong>
              {t("rentals.resources.summaryBreakdown", {
                spaces: t("rentals.resources.summarySpaces", { count: spaceCount }),
                items: t("rentals.resources.summaryItems", { count: assets.length - spaceCount }),
              })}
            </p>
            <span className="resources-edit-hint">{t("rentals.resources.editHint")}</span>
          </div>
        <ul className="resources-list">
          {assets.map((asset) => {
            const Icon = asset.type === "Good" ? Package : DoorOpen
            return (
            <li key={asset.id} className="resource-list-item">
              <button
                type="button"
                className="resource-row"
                onClick={() => {
                  openEdit(asset)
                }}
              >
                <span className="resource-icon" aria-hidden="true">
                  <Icon className="size-5" strokeWidth={ICON_STROKE_WIDTH} />
                </span>
                <div className="resource-info">
                  <div className="resource-title">
                    <p>{asset.name}</p>
                    {asset.scheduledDeletionAt ? (
                      <Badge variant="destructive" className="resource-deletion-badge">
                        {t("assets.deletion.pendingBadge")}
                      </Badge>
                    ) : null}
                    <Badge variant="outline">
                      {asset.type === "Good"
                        ? t("rentals.resources.typeGood")
                        : t("rentals.resources.typeLocation")}
                    </Badge>
                  </div>
                  {asset.categoryName || asset.type === "Good" || asset.location ? (
                    <p className="resource-category">
                      {[
                        asset.categoryName,
                        asset.type === "Good"
                          ? t("rentals.resources.quantitySummary", { count: asset.totalQuantity })
                          : null,
                        asset.location,
                      ].filter(Boolean).join(" · ")}
                    </p>
                  ) : null}
                  <RentalResourceDetails
                    asset={asset}
                    pricePerHour={priceByAssetId[asset.assetId]?.pricePerHour}
                    pricingUnit={priceByAssetId[asset.assetId]?.pricingUnit}
                    compact
                    showUnpriced={canReadPricing}
                  />
                </div>
                <Pencil
                  className="resource-edit-icon size-4 shrink-0"
                  strokeWidth={ICON_STROKE_WIDTH}
                  aria-hidden
                />
              </button>
            </li>
          )})}
        </ul>
        </section>
      )}

    </div>
  )
}
