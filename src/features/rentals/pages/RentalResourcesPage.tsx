import { useCallback, useEffect, useState } from "react"
import { Boxes, ChevronRight, Plus } from "lucide-react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { PageContentSkeleton } from "@/components/loading/PageContentSkeleton"
import { Button } from "@/components/ui/button"
import { RentalResourceSheet } from "@/features/rentals/components/RentalResourceSheet"
import { ScheduleEmptyState } from "@/features/rentals/components/schedule/ScheduleEmptyState"
import type { AssetFamily } from "@/features/assets/schemas/assetFamilySchemas"
import type { Unit } from "@/features/assets/schemas/unitSchemas"
import { getUnits } from "@/features/assets/services/unitsService"
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

export function RentalResourcesPage() {
  const { t } = useTranslation()
  const { can } = usePermissions()
  const { isTrialReadOnly } = useTrialStatus()

  const [assets, setAssets] = useState<AdminRentalAsset[]>([])
  const [categories, setCategories] = useState<RegistryCategoryListItem[]>([])
  const [families, setFamilies] = useState<AssetFamily[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<AdminRentalAsset | null>(null)

  const canWrite = can("rentals.assets.write") && !isTrialReadOnly

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
      setCategories(categoryList)
      setFamilies(familyList)
      setUnits(unitList)
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : t("rentals.resources.loadError")
      setLoadError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  function openCreate() {
    setEditing(null)
    setSheetOpen(true)
  }

  function openEdit(asset: AdminRentalAsset) {
    if (!canWrite) {
      return
    }
    setEditing(asset)
    setSheetOpen(true)
  }

  async function handleSubmit(values: RentalResourceFormValues): Promise<boolean> {
    setBusy(true)
    try {
      const body = toCreateRentableRequest(values)
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
      <div className="mx-auto w-full max-w-xl space-y-4 text-center">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("rentals.resources.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("rentals.resources.description")}
          </p>
        </div>
      </div>

      <div className="flex sm:justify-end">
        <Can permission="rentals.assets.write">
          <Button
            type="button"
            className="w-full sm:w-auto"
            disabled={!canWrite || loading || loadError !== null || categories.length === 0}
            onClick={openCreate}
          >
            <Plus data-icon="inline-start" />
            {t("rentals.resources.add")}
          </Button>
        </Can>
      </div>

      {loading ? (
        <PageContentSkeleton rows={4} />
      ) : loadError !== null ? (
        <p className="text-sm text-destructive" role="alert">
          {loadError}
        </p>
      ) : categories.length === 0 ? (
        <ScheduleEmptyState
          icon={Boxes}
          title={t("rentals.resources.emptyCategoriesTitle")}
          description={t("rentals.resources.emptyCategoriesDescription")}
        />
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
                className="group flex w-full items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-left transition-colors hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => {
                  openEdit(asset)
                }}
                disabled={!canWrite}
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
                </div>
                {canWrite ? (
                  <ChevronRight
                    className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                    aria-hidden
                  />
                ) : null}
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
        onSubmit={handleSubmit}
      />
    </div>
  )
}
