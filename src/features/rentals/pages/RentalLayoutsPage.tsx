import { useCallback, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { PageContentSkeleton } from "@/components/loading/PageContentSkeleton"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { LoadingButton } from "@/components/ui/loading-button"
import { Switch } from "@/components/ui/switch"
import { LayoutCanvasBoard } from "@/features/rentals/components/layout/LayoutCanvasBoard"
import {
  arrangeEvenly,
  autoPlaceItems,
  DEFAULT_ASPECT_RATIO,
  DEFAULT_CANVAS_WIDTH_PERCENT,
  fitLayoutToContent,
  fitPlacement,
  type LayoutPlacement,
} from "@/features/rentals/components/layout/layoutCanvasModel"
import {
  createRentalLayout,
  deleteRentalLayout,
  listRentalLayouts,
  updateRentalLayout,
  type RentalLayout,
} from "@/features/rentals/services/rentalLayoutService"
import {
  listAdminRentalAssets,
  type AdminRentalAsset,
} from "@/features/rentals/services/scheduleService"
import { useTrialStatus } from "@/features/users/hooks/useTrialStatus"

function placementsFromLayout(layout: RentalLayout): LayoutPlacement[] {
  return layout.items.map((item) => ({
    rentalAssetId: item.rentalAssetId,
    xPercent: item.xPercent,
    yPercent: item.yPercent,
    widthPercent: item.widthPercent,
    heightPercent: item.heightPercent,
    zIndex: item.zIndex,
  }))
}

export function RentalLayoutsPage() {
  const { t } = useTranslation()
  const { isTrialReadOnly } = useTrialStatus()
  const [layouts, setLayouts] = useState<RentalLayout[]>([])
  const [assets, setAssets] = useState<AdminRentalAsset[]>([])
  const [selectedId, setSelectedId] = useState<string | "new" | "">("")
  const [name, setName] = useState("")
  const [isActive, setIsActive] = useState(true)
  const [placements, setPlacements] = useState<LayoutPlacement[]>([])
  const [aspectRatio, setAspectRatio] = useState(DEFAULT_ASPECT_RATIO)
  const [canvasWidthPercent, setCanvasWidthPercent] = useState(
    DEFAULT_CANVAS_WIDTH_PERCENT,
  )
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const selectedLayout =
    selectedId !== "" && selectedId !== "new"
      ? (layouts.find((layout) => layout.id === selectedId) ?? null)
      : null

  const placedIds = useMemo(
    () => new Set(placements.map((item) => item.rentalAssetId)),
    [placements],
  )

  const unusedAssets = assets.filter((asset) => !placedIds.has(asset.id))
  const assetNameById = useMemo(
    () => new Map(assets.map((asset) => [asset.id, asset.name])),
    [assets],
  )

  function applyLayout(layout: RentalLayout) {
    setSelectedId(layout.id)
    setName(layout.name)
    setIsActive(layout.isActive)
    setPlacements(placementsFromLayout(layout).map(fitPlacement))
    setAspectRatio(layout.aspectRatio)
    setCanvasWidthPercent(layout.widthPercent)
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [layoutList, assetList] = await Promise.all([
        listRentalLayouts(),
        listAdminRentalAssets(),
      ])
      setLayouts(layoutList)
      setAssets(assetList)
      const first = layoutList[0]
      if (first) {
        applyLayout(first)
      } else {
        setSelectedId("")
        setName("")
        setIsActive(true)
        setPlacements([])
        setAspectRatio(DEFAULT_ASPECT_RATIO)
        setCanvasWidthPercent(DEFAULT_CANVAS_WIDTH_PERCENT)
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("rentals.layout.loadError"),
      )
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  function startCreate() {
    setSelectedId("new")
    setName(t("rentals.layout.defaultName"))
    setIsActive(true)
    setAspectRatio(DEFAULT_ASPECT_RATIO)
    setCanvasWidthPercent(DEFAULT_CANVAS_WIDTH_PERCENT)
    setPlacements(autoPlaceItems(assets.map((asset) => asset.id)))
  }

  function selectLayout(id: string) {
    const layout = layouts.find((item) => item.id === id)
    if (!layout) {
      return
    }
    applyLayout(layout)
  }

  function organizeEvenly() {
    setPlacements(
      arrangeEvenly(placements.map((item) => item.rentalAssetId)),
    )
  }

  function fitToContent() {
    const fitted = fitLayoutToContent(
      placements,
      aspectRatio,
      canvasWidthPercent,
    )
    setPlacements(fitted.placements)
    setAspectRatio(fitted.aspectRatio)
    setCanvasWidthPercent(fitted.widthPercent)
  }

  function patchPlacement(
    rentalAssetId: string,
    patch: Partial<LayoutPlacement>,
  ) {
    setPlacements((current) =>
      current.map((item) =>
        item.rentalAssetId === rentalAssetId
          ? fitPlacement({ ...item, ...patch })
          : item,
      ),
    )
  }

  function addAsset(rentalAssetId: string) {
    const next = autoPlaceItems([rentalAssetId])[0]
    if (!next) {
      return
    }
    const occupied = placements.length
    const auto = autoPlaceItems([...placements.map((p) => p.rentalAssetId), rentalAssetId])
    const placed = auto[occupied] ?? next
    setPlacements((current) => [
      ...current,
      { ...placed, zIndex: current.length },
    ])
  }

  function removeAsset(rentalAssetId: string) {
    setPlacements((current) =>
      current.filter((item) => item.rentalAssetId !== rentalAssetId),
    )
  }

  async function onSave() {
    if (!name.trim()) {
      toast.error(t("rentals.layout.nameRequired"))
      return
    }
    setSaving(true)
    try {
      const payload = {
        name: name.trim(),
        isActive,
        aspectRatio,
        widthPercent: canvasWidthPercent,
        items: placements.map(fitPlacement),
      }
      if (selectedId === "new" || selectedId === "") {
        const created = await createRentalLayout(payload)
        toast.success(t("rentals.layout.createSuccess"))
        setLayouts((current) => {
          const without = current.filter((item) => item.id !== created.id)
          return [...without, created].sort((left, right) =>
            left.name.localeCompare(right.name),
          )
        })
        applyLayout(created)
      } else {
        const updated = await updateRentalLayout(selectedId, payload)
        toast.success(t("rentals.layout.updateSuccess"))
        setLayouts((current) =>
          current.map((item) => (item.id === updated.id ? updated : item)),
        )
        applyLayout(updated)
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("rentals.layout.saveError"),
      )
    } finally {
      setSaving(false)
    }
  }

  async function onDelete() {
    if (!selectedLayout) {
      return
    }
    setSaving(true)
    try {
      await deleteRentalLayout(selectedLayout.id)
      toast.success(t("rentals.layout.deleteSuccess"))
      await load()
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("rentals.layout.deleteError"),
      )
    } finally {
      setSaving(false)
    }
  }

  const editorOpen = selectedId !== ""

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("rentals.layout.title")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("rentals.layout.description")}
        </p>
      </div>

      {isTrialReadOnly ? (
        <p className="text-sm text-amber-800 dark:text-amber-200" role="status">
          {t("trial.readOnlyHint")}
        </p>
      ) : null}

      {loading ? (
        <PageContentSkeleton rows={4} />
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="min-w-0 flex-1 space-y-1 text-sm">
              <span>{t("rentals.layout.select")}</span>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                value={selectedId === "new" ? "new" : selectedId}
                onChange={(event) => {
                  if (event.target.value === "new") {
                    startCreate()
                    return
                  }
                  selectLayout(event.target.value)
                }}
              >
                {layouts.length === 0 && selectedId !== "new" ? (
                  <option value="">{t("rentals.layout.empty")}</option>
                ) : null}
                {selectedId === "new" ? (
                  <option value="new">{t("rentals.layout.newDraft")}</option>
                ) : null}
                {layouts.map((layout) => (
                  <option key={layout.id} value={layout.id}>
                    {layout.name}
                    {layout.isActive ? "" : ` (${t("rentals.layout.inactive")})`}
                  </option>
                ))}
              </select>
            </label>
            <Button
              type="button"
              variant="outline"
              disabled={isTrialReadOnly}
              onClick={startCreate}
            >
              {t("rentals.layout.create")}
            </Button>
          </div>

          {editorOpen ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                <label className="space-y-1 text-sm">
                  <span>{t("rentals.layout.name")}</span>
                  <Input
                    value={name}
                    disabled={isTrialReadOnly}
                    onChange={(event) => {
                      setName(event.target.value)
                    }}
                  />
                </label>
                <label className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm sm:min-w-48">
                  <span>{t("rentals.layout.active")}</span>
                  <Switch
                    checked={isActive}
                    disabled={isTrialReadOnly}
                    onCheckedChange={(checked) => {
                      setIsActive(Boolean(checked))
                    }}
                  />
                </label>
              </div>

              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_16rem]">
                <LayoutCanvasBoard
                  mode="edit"
                  aspectRatio={aspectRatio}
                  canvasWidthPercent={canvasWidthPercent}
                  items={placements.map((item) => ({
                    key: item.rentalAssetId,
                    rentalAssetId: item.rentalAssetId,
                    label:
                      assetNameById.get(item.rentalAssetId) ??
                      item.rentalAssetId,
                    xPercent: item.xPercent,
                    yPercent: item.yPercent,
                    widthPercent: item.widthPercent,
                    heightPercent: item.heightPercent,
                    zIndex: item.zIndex,
                  }))}
                  onMove={(rentalAssetId, xPercent, yPercent) => {
                    patchPlacement(rentalAssetId, { xPercent, yPercent })
                  }}
                  onResize={(rentalAssetId, widthPercent, heightPercent) => {
                    patchPlacement(rentalAssetId, {
                      widthPercent,
                      heightPercent,
                    })
                  }}
                  onFrameResize={(nextAspect, nextWidth) => {
                    setAspectRatio(nextAspect)
                    setCanvasWidthPercent(nextWidth)
                  }}
                  onRemove={isTrialReadOnly ? undefined : removeAsset}
                />
                <div className="space-y-2">
                  <p className="text-sm font-medium">
                    {t("rentals.layout.palette")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("rentals.layout.paletteHelp")}
                  </p>
                  {unusedAssets.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      {t("rentals.layout.paletteEmpty")}
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {unusedAssets.map((asset) => (
                        <li key={asset.id}>
                          <Button
                            type="button"
                            variant="outline"
                            className="w-full justify-start"
                            disabled={isTrialReadOnly}
                            onClick={() => {
                              addAsset(asset.id)
                            }}
                          >
                            {asset.name}
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {t("rentals.layout.clickToRemove")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("rentals.layout.resizeCanvasHelp")}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <LoadingButton
                  type="button"
                  loading={saving}
                  disabled={isTrialReadOnly}
                  onClick={() => {
                    void onSave()
                  }}
                >
                  {t("rentals.layout.save")}
                </LoadingButton>
                <Button
                  type="button"
                  variant="outline"
                  disabled={saving || isTrialReadOnly || placements.length === 0}
                  onClick={organizeEvenly}
                >
                  {t("rentals.layout.organize")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={saving || isTrialReadOnly || placements.length === 0}
                  onClick={fitToContent}
                >
                  {t("rentals.layout.fitToContent")}
                </Button>
                {selectedLayout ? (
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={saving || isTrialReadOnly}
                    onClick={() => {
                      void onDelete()
                    }}
                  >
                    {t("common.delete")}
                  </Button>
                ) : null}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {t("rentals.layout.emptyHint")}
            </p>
          )}
        </>
      )}
    </div>
  )
}
