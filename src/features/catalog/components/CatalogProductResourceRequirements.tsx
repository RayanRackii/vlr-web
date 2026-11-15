import { useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Boxes, Clock, Pencil, Plus, Search, Trash2 } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { fieldControlClass } from "@/components/ui/fieldControl"
import { Input } from "@/components/ui/input"
import { LoadingButton } from "@/components/ui/loading-button"
import { useStepSubmit } from "@/features/assistant/stepSubmit"
import {
  CatalogPlanningVersionConflictError,
  CatalogRetryableError,
  getCatalogProductResourceRequirements,
  replaceCatalogProductResourceRequirements,
} from "@/features/catalog/services/catalogService"
import type { CatalogProductResourceRequirement } from "@/features/catalog/schemas/catalogSchemas"
import { listAdminRentalAssets, type AdminRentalAsset } from "@/features/rentals/services/scheduleService"

type CatalogProductResourceRequirementsProps = {
  productId: string
  readOnly?: boolean
  onSaved?: () => void | Promise<void>
  onDirtyChange?: (dirty: boolean) => void
  onSavingChange?: (saving: boolean) => void
}

type DraftRow = CatalogProductResourceRequirement & { clientId: string }

type RequirementValues = {
  resourceQuantity: number
  durationMinutesPerUnit: number
  prepMinutes: number
  cleanupMinutes: number
}

type DialogState = { mode: "add" } | { mode: "edit"; clientId: string }

let clientIdCounter = 0
function nextClientId(): string {
  clientIdCounter += 1
  return `requirement-${clientIdCounter}`
}

function rowSnapshot(rows: readonly DraftRow[]): string {
  return JSON.stringify(rows.map((row) => ({
    rentalAssetId: row.rentalAssetId,
    resourceQuantity: row.resourceQuantity,
    durationMinutesPerUnit: row.durationMinutesPerUnit,
    prepMinutes: row.prepMinutes,
    cleanupMinutes: row.cleanupMinutes,
  })))
}

function newRow(rentalAssetId: string, values: RequirementValues): DraftRow {
  return {
    clientId: nextClientId(),
    id: null,
    rentalAssetId,
    assetCategoryId: null,
    ...values,
  }
}

function assetTypeLabel(t: (key: string) => string, asset: AdminRentalAsset | undefined): string {
  if (!asset) return ""
  const type = t(`agendas.grid.resourceType.${asset.type}`)
  return asset.categoryName ? `${type} · ${asset.categoryName}` : type
}

type RequirementDialogProps = {
  mode: "add" | "edit"
  assets: readonly AdminRentalAsset[]
  takenIds: ReadonlySet<string>
  initialAssetId: string | null
  initialValues: RequirementValues | null
  onCancel: () => void
  onConfirm: (assetId: string, values: RequirementValues) => void
}

function RequirementDialog({
  mode,
  assets,
  takenIds,
  initialAssetId,
  initialValues,
  onCancel,
  onConfirm,
}: RequirementDialogProps) {
  const { t } = useTranslation()
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState("all")
  const [selectedId, setSelectedId] = useState<string | null>(initialAssetId)
  const [quantity, setQuantity] = useState(String(initialValues?.resourceQuantity ?? 1))
  const [duration, setDuration] = useState(String(initialValues?.durationMinutesPerUnit ?? 60))
  const [prep, setPrep] = useState(String(initialValues?.prepMinutes ?? 0))
  const [cleanup, setCleanup] = useState(String(initialValues?.cleanupMinutes ?? 0))

  const editing = mode === "edit"
  const selected = assets.find((asset) => asset.id === selectedId)
  const types = useMemo(() => [...new Set(assets.map((asset) => asset.type))], [assets])
  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return assets.filter(
      (asset) =>
        (typeFilter === "all" || asset.type === typeFilter) &&
        (needle === "" || asset.name.toLowerCase().includes(needle)),
    )
  }, [assets, search, typeFilter])

  const quantityValue = Number(quantity)
  const durationValue = Number(duration)
  const prepValue = Number(prep)
  const cleanupValue = Number(cleanup)
  const valid =
    selectedId !== null &&
    quantity.trim() !== "" && Number.isInteger(quantityValue) && quantityValue >= 1 &&
    duration.trim() !== "" && Number.isInteger(durationValue) && durationValue >= 1 &&
    prep.trim() !== "" && Number.isInteger(prepValue) && prepValue >= 0 &&
    cleanup.trim() !== "" && Number.isInteger(cleanupValue) && cleanupValue >= 0
  const total = (prepValue || 0) + (durationValue || 0) + (cleanupValue || 0)

  const numberField = (
    id: string,
    label: string,
    suffix: string,
    value: string,
    setValue: (next: string) => void,
    min: number,
  ) => (
    <div className="grid gap-1.5 text-sm font-medium">
      <label htmlFor={id}>{label}</label>
      <div className="relative">
        <Input
          id={id}
          type="number"
          min={min}
          step={1}
          value={value}
          className="pr-10"
          onChange={(event) => setValue(event.target.value)}
        />
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-normal text-muted-foreground">
          {suffix}
        </span>
      </div>
    </div>
  )

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onCancel() }}>
      <DialogContent
        className={`gap-0 p-0 max-sm:top-0 max-sm:left-0 max-sm:h-dvh max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none max-sm:overflow-y-auto ${editing ? "sm:max-w-[480px]" : "sm:max-w-[720px]"}`}
      >
        <DialogHeader className="border-b p-4 pr-12">
          <DialogTitle>
            {t(editing ? "catalog.resourcePlanning.dialog.editTitle" : "catalog.resourcePlanning.dialog.addTitle")}
          </DialogTitle>
          <DialogDescription>{t("catalog.resourcePlanning.dialog.description")}</DialogDescription>
        </DialogHeader>

        <div className={`grid min-h-0 ${editing ? "" : "sm:grid-cols-[minmax(0,17rem)_minmax(0,1fr)]"}`}>
          {editing ? null : (
            <div className="space-y-2 border-b p-4 sm:border-r sm:border-b-0">
              <div className="relative">
                <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="search"
                  aria-label={t("catalog.resourcePlanning.dialog.searchLabel")}
                  placeholder={t("catalog.resourcePlanning.dialog.searchLabel")}
                  className="pl-9"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
              <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>{t("catalog.resourcePlanning.dialog.count", { count: visible.length })}</span>
                <select
                  aria-label={t("catalog.resourcePlanning.dialog.typeFilter")}
                  className={`${fieldControlClass} h-8 w-auto max-w-[9rem] rounded-md px-2 text-xs`}
                  value={typeFilter}
                  onChange={(event) => setTypeFilter(event.target.value)}
                >
                  <option value="all">{t("catalog.resourcePlanning.dialog.allTypes")}</option>
                  {types.map((type) => (
                    <option key={type} value={type}>{t(`agendas.grid.resourceType.${type}`)}</option>
                  ))}
                </select>
              </div>
              {assets.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("catalog.productWizard.noResources")}</p>
              ) : visible.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("catalog.resourcePlanning.dialog.noMatches")}</p>
              ) : (
                <div role="radiogroup" aria-label={t("catalog.resourcePlanning.fields.resource")} className="flex max-h-72 flex-col gap-2 overflow-y-auto">
                  {visible.map((asset) => {
                    const taken = takenIds.has(asset.id)
                    const checked = selectedId === asset.id
                    return (
                      <label
                        key={asset.id}
                        className={`flex items-start gap-2 rounded-lg border p-2.5 text-sm ${checked ? "border-primary bg-primary/5" : "border-border"} ${taken ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
                      >
                        <input
                          type="radio"
                          name="requirement-resource"
                          className="mt-1 accent-primary"
                          checked={checked}
                          disabled={taken}
                          onChange={() => setSelectedId(asset.id)}
                        />
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{asset.name}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {taken ? t("catalog.resourcePlanning.dialog.alreadyAdded") : assetTypeLabel(t, asset)}
                          </span>
                        </span>
                      </label>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          <div className="space-y-4 p-4">
            {selected ? (
              <>
                <div>
                  <p className="font-medium">{selected.name}</p>
                  <p className="text-sm text-muted-foreground">{t("catalog.resourcePlanning.dialog.selectedHint")}</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {numberField("requirement-quantity", t("catalog.resourcePlanning.fields.resourceQuantity"), t("catalog.resourcePlanning.fields.unitSuffix"), quantity, setQuantity, 1)}
                  {numberField("requirement-duration", t("catalog.resourcePlanning.fields.durationMinutesPerUnit"), t("catalog.resourcePlanning.fields.minuteSuffix"), duration, setDuration, 1)}
                  {numberField("requirement-prep", t("catalog.resourcePlanning.fields.prepMinutes"), t("catalog.resourcePlanning.fields.minuteSuffix"), prep, setPrep, 0)}
                  {numberField("requirement-cleanup", t("catalog.resourcePlanning.fields.cleanupMinutes"), t("catalog.resourcePlanning.fields.minuteSuffix"), cleanup, setCleanup, 0)}
                </div>
                <div className="space-y-1 rounded-lg bg-muted/60 p-3">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    <Clock aria-hidden className="size-4 text-muted-foreground" />
                    {t("catalog.resourcePlanning.dialog.summaryTotal", { total })}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("catalog.resourcePlanning.breakdown", { prep: prepValue || 0, duration: durationValue || 0, cleanup: cleanupValue || 0 })}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">{t("catalog.resourcePlanning.dialog.note")}</p>
              </>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">{t("catalog.resourcePlanning.dialog.pickPrompt")}</p>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t p-4 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-xs text-muted-foreground">
            {selected
              ? t("catalog.resourcePlanning.dialog.selectedCount", { count: 1 })
              : t("catalog.resourcePlanning.dialog.noneSelected")}
          </span>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button type="button" variant="outline" onClick={onCancel}>{t("common.cancel")}</Button>
            <Button
              type="button"
              disabled={!valid}
              onClick={() => {
                if (!valid || selectedId === null) return
                onConfirm(selectedId, {
                  resourceQuantity: quantityValue,
                  durationMinutesPerUnit: durationValue,
                  prepMinutes: prepValue,
                  cleanupMinutes: cleanupValue,
                })
              }}
            >
              {t(editing ? "catalog.resourcePlanning.dialog.confirmEdit" : "catalog.resourcePlanning.dialog.confirmAdd")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function CatalogProductResourceRequirements({
  productId,
  readOnly = false,
  onSaved,
  onDirtyChange,
  onSavingChange,
}: CatalogProductResourceRequirementsProps) {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [expectedVersion, setExpectedVersion] = useState(0)
  const [rows, setRows] = useState<DraftRow[]>([])
  const [assets, setAssets] = useState<AdminRentalAsset[]>([])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<{ message: string; blocking: boolean } | null>(null)
  const [baseline, setBaseline] = useState<string | null>(null)
  const [loadedForProductId, setLoadedForProductId] = useState(productId)
  const [dialog, setDialog] = useState<DialogState | null>(null)

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
        const nextRows = response.requirements.map((row) => ({ ...row, clientId: nextClientId() }))
        setRows(nextRows)
        setBaseline(rowSnapshot(nextRows))
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
        const nextRows = response.requirements.map((row) => ({ ...row, clientId: nextClientId() }))
        setExpectedVersion(response.expectedVersion)
        setRows(nextRows)
        setBaseline(rowSnapshot(nextRows))
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

  useEffect(() => {
    if (!onDirtyChange) {
      return
    }
    onDirtyChange(!loading && baseline !== null && rowSnapshot(rows) !== baseline)
  }, [baseline, loading, onDirtyChange, rows])

  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange])
  useEffect(() => () => onSavingChange?.(false), [onSavingChange])

  const rowsRef = useRef(rows)
  useEffect(() => {
    rowsRef.current = rows
  }, [rows])

  function removeRow(clientId: string) {
    setSaveError(null)
    setRows((current) => current.filter((row) => row.clientId !== clientId))
  }

  function confirmDialog(assetId: string, values: RequirementValues) {
    setSaveError(null)
    if (dialog?.mode === "edit") {
      const { clientId } = dialog
      setRows((current) =>
        current.map((row) => (row.clientId === clientId ? { ...row, rentalAssetId: assetId, ...values } : row)),
      )
    } else {
      setRows((current) => [...current, newRow(assetId, values)])
    }
    setDialog(null)
  }

  async function save(): Promise<boolean> {
    const invalid = rowsRef.current.some((row) => !row.rentalAssetId)
    if (invalid) {
      const message = t("catalog.resourcePlanning.errors.resourceRequired")
      setSaveError({ message, blocking: false })
      toast.error(message)
      return false
    }

    const sent = rowSnapshot(rowsRef.current)
    setSaving(true)
    onSavingChange?.(true)
    setSaveError(null)
    try {
      const response = await replaceCatalogProductResourceRequirements(productId, {
        expectedVersion,
        requirements: rowsRef.current.map((row) => ({
          rentalAssetId: row.rentalAssetId,
          assetCategoryId: null,
          resourceQuantity: row.resourceQuantity,
          durationMinutesPerUnit: row.durationMinutesPerUnit,
          prepMinutes: row.prepMinutes,
          cleanupMinutes: row.cleanupMinutes,
        })),
      })
      setExpectedVersion(response.expectedVersion)
      if (rowSnapshot(rowsRef.current) === sent) {
        const nextRows = response.requirements.map((row) => ({ ...row, clientId: nextClientId() }))
        setRows(nextRows)
        setBaseline(rowSnapshot(nextRows))
      }
      toast.success(t("catalog.resourcePlanning.toastSaved"))
      await onSaved?.()
      return true
    } catch (error) {
      if (error instanceof CatalogPlanningVersionConflictError) {
        setSaveError({ message: error.message, blocking: false })
        toast.error(error.message)
        reload()
        return false
      }
      const message =
        error instanceof Error && error.message
          ? error.message
          : t("catalog.resourcePlanning.errors.saveRequirements")
      // Network/5xx failures are transient: show the error but keep Save enabled.
      // Validation/business refusals (4xx) block re-saving the same rows.
      setSaveError({ message, blocking: !(error instanceof CatalogRetryableError) })
      toast.error(message)
      return false
    } finally {
      setSaving(false)
      onSavingChange?.(false)
    }
  }

  const dirty = !loading && baseline !== null && rowSnapshot(rows) !== baseline
  // Inside the cadastro shell the footer saves; the step's own Save button is hidden.
  const shellDrivesSave = useStepSubmit(async () => {
    if (readOnly || !dirty) {
      return true
    }
    if (saving || (saveError?.blocking ?? false)) {
      return false
    }
    return save()
  })

  if (loading) {
    return (
      <p className="text-sm text-muted-foreground">{t("catalog.resourcePlanning.loading")}</p>
    )
  }

  if (loadError) {
    return <p className="text-sm text-destructive">{loadError}</p>
  }

  const assetById = new Map(assets.map((asset) => [asset.id, asset]))
  const selectableAssets = assets.filter((asset) => asset.isActive !== false)
  const takenIds = new Set(rows.map((row) => row.rentalAssetId).filter((id): id is string => !!id))
  const editingRow = dialog?.mode === "edit" ? rows.find((row) => row.clientId === dialog.clientId) : undefined

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">{t("catalog.resourcePlanning.title")}</h3>
          <p className="text-sm text-muted-foreground">
            {rows.length === 0
              ? t("catalog.resourcePlanning.subtitleEmpty")
              : t("catalog.resourcePlanning.subtitleCount", { count: rows.length })}
          </p>
        </div>
        {readOnly ? null : (
          <Button type="button" variant="outline" disabled={saving} onClick={() => setDialog({ mode: "add" })}>
            <Plus aria-hidden className="size-4" />
            {t("catalog.resourcePlanning.addRequirement")}
          </Button>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border px-4 py-10 text-center">
          <span className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <Boxes aria-hidden className="size-5" />
          </span>
          <p className="font-medium">{t("catalog.resourcePlanning.empty.title")}</p>
          <p className="max-w-sm text-sm text-muted-foreground">{t("catalog.resourcePlanning.empty.description")}</p>
          {readOnly ? null : (
            <Button type="button" disabled={saving} onClick={() => setDialog({ mode: "add" })}>
              <Plus aria-hidden className="size-4" />
              {t("catalog.resourcePlanning.empty.action")}
            </Button>
          )}
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => {
            const asset = row.rentalAssetId ? assetById.get(row.rentalAssetId) : undefined
            const name = asset?.name ?? row.rentalAssetId ?? ""
            const total = row.prepMinutes + row.durationMinutesPerUnit + row.cleanupMinutes
            const stats: Array<[string, string]> = [
              [t("catalog.resourcePlanning.fields.resourceQuantity"), t("catalog.resourcePlanning.card.units", { count: row.resourceQuantity })],
              [t("catalog.resourcePlanning.fields.durationMinutesPerUnit"), t("catalog.resourcePlanning.card.minutes", { count: row.durationMinutesPerUnit })],
              [t("catalog.resourcePlanning.fields.prepMinutes"), t("catalog.resourcePlanning.card.minutes", { count: row.prepMinutes })],
              [t("catalog.resourcePlanning.fields.cleanupMinutes"), t("catalog.resourcePlanning.card.minutes", { count: row.cleanupMinutes })],
            ]
            return (
              <li key={row.clientId} className="space-y-3 rounded-lg border border-border p-4">
                <div className="flex items-center gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <Boxes aria-hidden className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{name}</p>
                    <p className="truncate text-xs text-muted-foreground">{assetTypeLabel(t, asset)}</p>
                  </div>
                  {readOnly ? null : (
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={saving}
                        onClick={() => setDialog({ mode: "edit", clientId: row.clientId })}
                      >
                        <Pencil aria-hidden className="size-3.5" />
                        {t("common.edit")}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        disabled={saving}
                        aria-label={t("catalog.resourcePlanning.card.remove", { name })}
                        onClick={() => removeRow(row.clientId)}
                      >
                        <Trash2 aria-hidden className="size-4" />
                      </Button>
                    </div>
                  )}
                </div>
                <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                  {stats.map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-xs text-muted-foreground">{label}</dt>
                      <dd className="font-medium">{value}</dd>
                    </div>
                  ))}
                </dl>
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/60 px-3 py-2 text-sm">
                  <span className="flex items-center gap-2 font-medium">
                    <Clock aria-hidden className="size-4 text-muted-foreground" />
                    {t("catalog.resourcePlanning.card.occupancy", { total })}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {t("catalog.resourcePlanning.breakdown", { prep: row.prepMinutes, duration: row.durationMinutesPerUnit, cleanup: row.cleanupMinutes })}
                  </span>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <div className="space-y-1 rounded-lg bg-muted/60 p-4">
        <p className="text-sm font-medium">{t("catalog.resourcePlanning.info.title")}</p>
        <p className="text-sm text-muted-foreground">{t("catalog.resourcePlanning.info.body")}</p>
      </div>

      {saveError ? (
        <Alert variant="destructive">
          <AlertTitle>{t("catalog.resourcePlanning.saveErrorTitle")}</AlertTitle>
          <AlertDescription>{saveError.message}</AlertDescription>
        </Alert>
      ) : null}

      {readOnly || shellDrivesSave ? null : (
        <div className="flex justify-end">
          <LoadingButton
            type="button"
            size="sm"
            loading={saving}
            disabled={saving || (saveError?.blocking ?? false)}
            onClick={() => void save()}
          >
            {t("catalog.resourcePlanning.save")}
          </LoadingButton>
        </div>
      )}

      {dialog && !readOnly && (dialog.mode === "add" || editingRow) ? (
        <RequirementDialog
          mode={dialog.mode}
          assets={dialog.mode === "edit" ? assets : selectableAssets}
          takenIds={dialog.mode === "edit" ? new Set<string>() : takenIds}
          initialAssetId={editingRow?.rentalAssetId ?? null}
          initialValues={editingRow ?? null}
          onCancel={() => setDialog(null)}
          onConfirm={confirmDialog}
        />
      ) : null}
    </div>
  )
}
