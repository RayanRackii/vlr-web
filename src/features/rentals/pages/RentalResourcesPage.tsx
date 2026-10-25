import { useCallback, useEffect, useState } from "react"
import { Boxes, ChevronRight, Plus } from "lucide-react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { PageContentSkeleton } from "@/components/loading/PageContentSkeleton"
import { ErrorState } from "@/components/ErrorState"
import { PageHeader } from "@/components/layout/PageHeader"
import { Button } from "@/components/ui/button"
import { RentalResourceSheet } from "@/features/rentals/components/RentalResourceSheet"
import { RentalResourceDetails } from "@/features/rentals/components/RentalResourceDetails"
import { ScheduleEmptyState } from "@/features/rentals/components/schedule/ScheduleEmptyState"
import type { AssetFamily } from "@/features/assets/schemas/assetFamilySchemas"
import type { Unit } from "@/features/assets/schemas/unitSchemas"
import { getUnits } from "@/features/assets/services/unitsService"
import { getAssetPricings, type RentalPricing } from "@/features/assets/services/rentalPricingService"
import {
  toCreateRentableRequest,
  type RegistryCategoryListItem,
  type RentalResourceFormValues,
} from "@/features/rentals/schemas/rentalResourceSchemas"
import {
  createRentalAsset,
  listRentalAssetCategories,
  listRentalAssetFamilies,
  updateRentalAsset,
} from "@/features/rentals/services/rentalResourcesService"
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
  const { can } = usePermissions()
  const { isTrialReadOnly } = useTrialStatus()

  const [assets, setAssets] = useState<AdminRentalAsset[]>([])
  const [priceByAssetId, setPriceByAssetId] = useState<Record<string, ResourcePrice>>({})
  const [categories, setCategories] = useState<RegistryCategoryListItem[]>([])
  const [families, setFamilies] = useState<AssetFamily[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<AdminRentalAsset | null>(null)

  const canWrite = can("rentals.assets.write") && !isTrialReadOnly
  const canReadPricing = can("rentals.pricing.read")

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const [assetList, categoryList, familyList, unitList] = await Promise.all([
        listAdminRentalAssets(),
        listRentalAssetCategories(),
        listRentalAssetFamilies(),
        getUnits(),
      ])
      setAssets(assetList)
      if (canReadPricing) {
        const prices = await Promise.all(assetList.map(async (asset) => {
          try {
            const pricings = await getAssetPricings(asset.assetId)
            const lowestPrice = pricings.reduce<RentalPricing | null>(
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
      setCategories(categoryList)
      setFamilies(familyList)
      setUnits(unitList)
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
    void load()
  }, [load])

  function openCreate() {
    setEditing(null)
    setSheetOpen(true)
  }

  function openEdit(asset: AdminRentalAsset) {
    setEditing(asset)
    setSheetOpen(true)
  }

  async function handleSubmit(
    values: RentalResourceFormValues,
  ): Promise<boolean> {
    if (!canWrite) {
      return false
    }
    setBusy(true)
    try {
      const body = toCreateRentableRequest(values, {
        creating: editing === null,
        stored: editing?.maxAdvanceBookingDays,
        storedVisualTemplateRevisionId: editing?.visualTemplateRevisionId,
        storedCapacityPeople: editing?.capacityPeople,
      })
      if (editing) {
        await updateRentalAsset(editing.id, body)
        toast.success(t("rentals.resources.updateSuccess"))
      } else {
        await createRentalAsset(body)
        toast.success(t("rentals.resources.createSuccess"))
      }
      await load()
      return true
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : editing
            ? t("rentals.resources.updateError")
            : t("rentals.resources.createError"),
      )
      return false
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <PageHeader
        icon={Boxes}
        title={t("rentals.resources.title")}
        description={t("rentals.resources.description")}
        actions={
          <Can permission="rentals.assets.write">
            <Button
              type="button"
              disabled={!canWrite || loading || loadError !== null}
              onClick={openCreate}
            >
              <Plus data-icon="inline-start" />
              {t("rentals.resources.add")}
            </Button>
          </Can>
        }
      />

      {loading ? (
        <PageContentSkeleton rows={4} />
      ) : loadError !== null ? (
        <ErrorState message={loadError} onRetry={() => void load()} />
      ) : assets.length === 0 ? (
        <ScheduleEmptyState
          icon={Boxes}
          title={t("rentals.resources.emptyTitle")}
          description={t("rentals.resources.emptyDescription")}
          actionLabel={canWrite ? t("rentals.resources.add") : undefined}
          onAction={canWrite ? openCreate : undefined}
        />
      ) : (
        <ul className="space-y-2">
          {assets.map((asset) => (
            <li key={asset.id}>
              <button
                type="button"
                className="group flex w-full items-center gap-3 rounded-xl border border-border bg-card px-4 py-3.5 text-left shadow-sm motion-safe:transition-shadow hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => {
                  openEdit(asset)
                }}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{asset.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {asset.type === "Good"
                      ? t("rentals.resources.typeGood")
                      : t("rentals.resources.typeLocation")}
                    {asset.categoryName ? ` · ${asset.categoryName}` : null}
                    {asset.type === "Good"
                      ? ` · ${t("rentals.resources.form.totalQuantity")}: ${asset.totalQuantity}`
                      : null}
                  </p>
                  <RentalResourceDetails asset={asset} pricePerHour={priceByAssetId[asset.assetId]?.pricePerHour} pricingUnit={priceByAssetId[asset.assetId]?.pricingUnit} />
                </div>
                <ChevronRight
                  className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                  aria-hidden
                />
              </button>
            </li>
          ))}
        </ul>
      )}

      <RentalResourceSheet
        open={sheetOpen}
        onOpenChange={(open) => {
          setSheetOpen(open)
          if (!open) {
            setEditing(null)
          }
        }}
        editing={editing}
        units={units}
        categories={categories}
        families={families}
        busy={busy}
        readOnly={!canWrite}
        pricePerHour={priceByAssetId[editing?.assetId ?? ""]?.pricePerHour}
        pricingUnit={priceByAssetId[editing?.assetId ?? ""]?.pricingUnit}
        onSubmit={handleSubmit}
      />
    </div>
  )
}
