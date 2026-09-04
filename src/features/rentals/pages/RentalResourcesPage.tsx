import { useCallback, useEffect, useState } from "react"
import { Boxes, Plus } from "lucide-react"
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
  const [busy, setBusy] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<AdminRentalAsset | null>(null)

  const canWrite = can("rentals.assets.write") && !isTrialReadOnly

  const load = useCallback(async () => {
    setLoading(true)
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
      toast.error(
        error instanceof Error
          ? error.message
          : t("rentals.resources.loadError"),
      )
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
    <div className="mx-auto w-full max-w-6xl space-y-6">
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

      <div className="flex justify-end">
        <Can permission="rentals.assets.write">
          <Button
            type="button"
            size="sm"
            disabled={!canWrite || loading || categories.length === 0}
            onClick={openCreate}
          >
            <Plus data-icon="inline-start" />
            {t("rentals.resources.add")}
          </Button>
        </Can>
      </div>

      {loading ? (
        <PageContentSkeleton rows={4} />
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
                className="flex w-full flex-col gap-1 rounded-lg border border-border px-4 py-3 text-left transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between"
                onClick={() => {
                  openEdit(asset)
                }}
                disabled={!canWrite}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">{asset.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {asset.type === "Good"
                      ? t("rentals.resources.typeGood")
                      : t("rentals.resources.typeLocation")}
                    {asset.categoryName ? ` · ${asset.categoryName}` : null}
                    {asset.type === "Good"
                      ? ` · ${t("rentals.resources.form.totalQuantity")}: ${asset.totalQuantity}`
                      : null}
                  </p>
                </div>
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
