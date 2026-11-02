import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { LoadingButton } from "@/components/ui/loading-button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  CatalogPlanningVersionConflictError,
  getCatalogProductResourceRequirements,
  replaceCatalogProductResourceRequirements,
} from "@/features/catalog/services/catalogService"
import type { CatalogProductResourceRequirement } from "@/features/catalog/schemas/catalogSchemas"
import { listAdminRentalAssets, type AdminRentalAsset } from "@/features/rentals/services/scheduleService"

type DraftRow = CatalogProductResourceRequirement & { clientId: string }

let clientIdCounter = 0
function nextClientId(): string {
  clientIdCounter += 1
  return `requirement-${clientIdCounter}`
}

function emptyRow(): DraftRow {
  return {
    clientId: nextClientId(),
    id: null,
    rentalAssetId: null,
    assetCategoryId: null,
    resourceQuantity: 1,
    durationMinutesPerUnit: 60,
    prepMinutes: 0,
    cleanupMinutes: 0,
  }
}

export function CatalogProductResourceRequirements({ productId }: { productId: string }) {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [expectedVersion, setExpectedVersion] = useState(0)
  const [rows, setRows] = useState<DraftRow[]>([])
  const [assets, setAssets] = useState<AdminRentalAsset[]>([])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [loadedForProductId, setLoadedForProductId] = useState(productId)

  // Reset to loading when the product changes (adjust state during render, not in the effect).
  if (loadedForProductId !== productId) {
    setLoadedForProductId(productId)
    setLoading(true)
  }

  useEffect(() => {
    let cancelled = false
    Promise.all([
      getCatalogProductResourceRequirements(productId),
      listAdminRentalAssets().catch(() => []),
    ])
      .then(([response, assetList]) => {
        if (cancelled) return
        setExpectedVersion(response.expectedVersion)
        setRows(response.requirements.map((row) => ({ ...row, clientId: nextClientId() })))
        setAssets(assetList)
        setLoadError(null)
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setLoadError(
          error instanceof Error
            ? error.message
            : t("catalog.resourcePlanning.errors.loadRequirements"),
        )
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload only when the product changes
  }, [productId])

  function reload() {
    setLoading(true)
    getCatalogProductResourceRequirements(productId)
      .then((response) => {
        setExpectedVersion(response.expectedVersion)
        setRows(response.requirements.map((row) => ({ ...row, clientId: nextClientId() })))
        setLoadError(null)
      })
      .catch((error: unknown) => {
        setLoadError(
          error instanceof Error
            ? error.message
            : t("catalog.resourcePlanning.errors.loadRequirements"),
        )
      })
      .finally(() => setLoading(false))
  }

  function updateRow(clientId: string, patch: Partial<DraftRow>) {
    setRows((current) =>
      current.map((row) => (row.clientId === clientId ? { ...row, ...patch } : row)),
    )
  }

  function removeRow(clientId: string) {
    setRows((current) => current.filter((row) => row.clientId !== clientId))
  }

  function addRow() {
    setRows((current) => [...current, emptyRow()])
  }

  async function save() {
    const invalid = rows.some((row) => !row.rentalAssetId)
    if (invalid) {
      toast.error(t("catalog.resourcePlanning.errors.resourceRequired"))
      return
    }

    setSaving(true)
    setSaveError(null)
    try {
      const response = await replaceCatalogProductResourceRequirements(productId, {
        expectedVersion,
        requirements: rows.map((row) => ({
          rentalAssetId: row.rentalAssetId,
          assetCategoryId: null,
          resourceQuantity: row.resourceQuantity,
          durationMinutesPerUnit: row.durationMinutesPerUnit,
          prepMinutes: row.prepMinutes,
          cleanupMinutes: row.cleanupMinutes,
        })),
      })
      setExpectedVersion(response.expectedVersion)
      setRows(response.requirements.map((row) => ({ ...row, clientId: nextClientId() })))
      toast.success(t("catalog.resourcePlanning.toastSaved"))
    } catch (error) {
      if (error instanceof CatalogPlanningVersionConflictError) {
        toast.error(error.message)
        reload()
        return
      }
      const message =
        error instanceof Error && error.message
          ? error.message
          : t("catalog.resourcePlanning.errors.saveRequirements")
      setSaveError(message)
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <p className="text-sm text-muted-foreground">{t("catalog.resourcePlanning.loading")}</p>
    )
  }

  if (loadError) {
    return <p className="text-sm text-destructive">{loadError}</p>
  }

  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      <div>
        <p className="text-sm font-medium">{t("catalog.resourcePlanning.title")}</p>
        <p className="text-xs text-muted-foreground">
          {t("catalog.resourcePlanning.description")}
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">
          {t("catalog.resourcePlanning.emptyState")}
        </p>
      ) : (
        <ul className="space-y-3">
          {rows.map((row, index) => (
            <li
              key={row.clientId}
              className="space-y-2 rounded-md border border-border p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">
                  {t("catalog.resourcePlanning.requirementLabel", { index: index + 1 })}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeRow(row.clientId)}
                >
                  {t("common.remove")}
                </Button>
              </div>
              <label className="grid gap-1 text-sm">
                <span>{t("catalog.resourcePlanning.fields.resource")}</span>
                <Select
                  modal={false}
                  value={row.rentalAssetId}
                  onValueChange={(value) => {
                    if (typeof value === "string") {
                      updateRow(row.clientId, { rentalAssetId: value })
                    }
                  }}
                  items={assets.map((asset) => ({ value: asset.id, label: asset.name }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t("catalog.resourcePlanning.fields.resourcePlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {assets.map((asset) => (
                      <SelectItem key={asset.id} value={asset.id}>
                        {asset.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
              <div className="grid gap-2 sm:grid-cols-4">
                <label className="grid gap-1 text-sm">
                  <span>{t("catalog.resourcePlanning.fields.resourceQuantity")}</span>
                  <Input
                    type="number"
                    min={1}
                    value={row.resourceQuantity}
                    onChange={(event) =>
                      updateRow(row.clientId, {
                        resourceQuantity: Math.max(1, Number(event.target.value) || 1),
                      })
                    }
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  <span>{t("catalog.resourcePlanning.fields.durationMinutesPerUnit")}</span>
                  <Input
                    type="number"
                    min={1}
                    value={row.durationMinutesPerUnit}
                    onChange={(event) =>
                      updateRow(row.clientId, {
                        durationMinutesPerUnit: Math.max(1, Number(event.target.value) || 1),
                      })
                    }
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  <span>{t("catalog.resourcePlanning.fields.prepMinutes")}</span>
                  <Input
                    type="number"
                    min={0}
                    value={row.prepMinutes}
                    onChange={(event) =>
                      updateRow(row.clientId, {
                        prepMinutes: Math.max(0, Number(event.target.value) || 0),
                      })
                    }
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  <span>{t("catalog.resourcePlanning.fields.cleanupMinutes")}</span>
                  <Input
                    type="number"
                    min={0}
                    value={row.cleanupMinutes}
                    onChange={(event) =>
                      updateRow(row.clientId, {
                        cleanupMinutes: Math.max(0, Number(event.target.value) || 0),
                      })
                    }
                  />
                </label>
              </div>
              <p className="text-xs text-muted-foreground">
                {t("catalog.resourcePlanning.calculationHint", {
                  duration: row.durationMinutesPerUnit,
                })}
              </p>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button type="button" variant="outline" size="sm" onClick={addRow}>
          {t("catalog.resourcePlanning.addRequirement")}
        </Button>
        <LoadingButton type="button" size="sm" loading={saving} onClick={() => void save()}>
          {t("catalog.resourcePlanning.save")}
        </LoadingButton>
      </div>
      {saveError ? (
        <p role="alert" className="text-sm text-destructive">
          {saveError}
        </p>
      ) : null}
    </div>
  )
}
