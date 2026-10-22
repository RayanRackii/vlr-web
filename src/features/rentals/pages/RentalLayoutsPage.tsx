import { useCallback, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { PageContentSkeleton } from "@/components/loading/PageContentSkeleton"
import { Badge } from "@/components/ui/badge"
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
import { Switch } from "@/components/ui/switch"
import { LayoutCanvasBoard } from "@/features/rentals/components/layout/LayoutCanvasBoard"
import {
  arrangeEvenly,
  autoPlaceItems,
  DEFAULT_ASPECT_RATIO,
  DEFAULT_CANVAS_WIDTH_PERCENT,
  fitPlacement,
  type LayoutPlacement,
} from "@/features/rentals/components/layout/layoutCanvasModel"
import {
  createRentalLayout,
  deleteRentalLayout,
  listRentalLayouts,
  type RentalLayout,
} from "@/features/rentals/services/rentalLayoutService"
import { getBookingMapSettings, getComposition, saveBookingMapSettings, saveComposition, type BookingMapSettings, type MapComposition } from "@/features/rentals/services/resourceVisualService"
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
  const [settings, setSettings] = useState<BookingMapSettings | null>(null)
  const [composition, setComposition] = useState<MapComposition | null>(null)
  const [selectedPlacementId, setSelectedPlacementId] = useState<string | null>(null)
  const [saveState, setSaveState] = useState<"idle" | "saved">("idle")

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

  function applyLayout(layout: RentalLayout, loadedComposition?: MapComposition) {
    setSelectedId(layout.id)
    setName(layout.name)
    setIsActive(layout.isActive)
    setPlacements((loadedComposition ? loadedComposition.items : placementsFromLayout(layout)).map((item) => fitPlacement({ rentalAssetId: item.rentalAssetId, xPercent: item.xPercent, yPercent: item.yPercent, widthPercent: item.widthPercent, heightPercent: item.heightPercent, zIndex: item.zIndex })))
    setAspectRatio(layout.aspectRatio)
    setCanvasWidthPercent(layout.widthPercent)
    setComposition(loadedComposition ?? null)
    setSelectedPlacementId(null)
    setSaveState("idle")
  }

  function markEdited() {
    setSaveState("idle")
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
      // Map settings have a distinct permission from layouts.read. A 403 here
      // must not hide layouts a read-only layout editor may inspect.
      void getBookingMapSettings().then(setSettings).catch(() => setSettings(null))
      const first = layoutList[0]
      if (first) {
        const loadedComposition = await getComposition(first.id)
        applyLayout(first, loadedComposition)
      } else {
        setSelectedId("")
        setName("")
        setIsActive(true)
        setPlacements([])
        setAspectRatio(DEFAULT_ASPECT_RATIO)
        setCanvasWidthPercent(DEFAULT_CANVAS_WIDTH_PERCENT)
        setComposition(null)
        setSelectedPlacementId(null)
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
    setComposition(null)
    setSelectedPlacementId(null)
    setSaveState("idle")
  }

  async function selectLayout(id: string) {
    const layout = layouts.find((item) => item.id === id)
    if (!layout) {
      return
    }
    try {
      applyLayout(layout, await getComposition(id))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("rentals.layout.loadError"))
    }
  }

  function organizeEvenly() {
    markEdited()
    setPlacements(
      arrangeEvenly(placements.map((item) => item.rentalAssetId)),
    )
  }

  function patchPlacement(
    rentalAssetId: string,
    patch: Partial<LayoutPlacement>,
  ) {
    markEdited()
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
    markEdited()
    setPlacements((current) => [
      ...current,
      { ...placed, zIndex: current.length },
    ])
    setSelectedPlacementId(rentalAssetId)
  }

  function removeAsset(rentalAssetId: string) {
    markEdited()
    setPlacements((current) =>
      current.filter((item) => item.rentalAssetId !== rentalAssetId),
    )
    setSelectedPlacementId((current) => current === rentalAssetId ? null : current)
  }

  function compositionPayload(current: MapComposition) {
    const originalByAssetId = new Map(
      current.items.map((item) => [item.rentalAssetId, item]),
    )
    return {
      expectedVersion: current.version,
      unitId: current.unitId,
      name: name.trim(),
      isActive,
      sortOrder: current.sortOrder,
      aspectRatio,
      widthPercent: canvasWidthPercent,
      decorations: current.decorations,
      items: placements.map((placement) => {
        const original = originalByAssetId.get(placement.rentalAssetId)
        return {
          ...fitPlacement(placement),
          id: original?.id,
          rotation: original?.rotation ?? 0,
          lockAspectRatio: original?.lockAspectRatio ?? true,
        }
      }),
    }
  }

  async function onSave() {
    if (!name.trim()) {
      toast.error(t("rentals.layout.nameRequired"))
      return
    }
    setSaving(true)
    const scrollPosition = { x: window.scrollX, y: window.scrollY }
    try {
      const legacyPayload = {
        name: name.trim(),
        isActive,
        aspectRatio,
        widthPercent: canvasWidthPercent,
        items: placements.map(fitPlacement),
      }
      if (selectedId === "new" || selectedId === "") {
        const created = await createRentalLayout(legacyPayload)
        const loadedComposition = await getComposition(created.id)
        const savedComposition = await saveComposition(created.id, compositionPayload(loadedComposition))
        toast.success(t("rentals.layout.createSuccess"))
        setLayouts((current) => {
          const without = current.filter((item) => item.id !== created.id)
          return [...without, created].sort((left, right) =>
            left.name.localeCompare(right.name),
          )
        })
        applyLayout(created, savedComposition)
      } else {
        if (!composition) {
          throw new Error(t("rentals.layout.loadError"))
        }
        const savedComposition = await saveComposition(selectedId, compositionPayload(composition))
        const updated = { ...selectedLayout!, ...savedComposition, items: savedComposition.items }
        toast.success(t("rentals.layout.updateSuccess"))
        setLayouts((current) =>
          current.map((item) => (item.id === updated.id ? updated : item)),
        )
        applyLayout(updated, savedComposition)
      }
      setSaveState("saved")
      requestAnimationFrame(() => window.scrollTo(scrollPosition.x, scrollPosition.y))
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

  async function saveSettings(patch: Partial<BookingMapSettings>) {
    if (!settings) return
    setSaving(true)
    try {
      const saved = await saveBookingMapSettings({ ...settings, ...patch, expectedVersion: settings.version })
      setSettings(saved)
      toast.success(t("resourceVisual.saved"))
    } catch (error) { toast.error(error instanceof Error ? error.message : t("rentals.layout.saveError")) } finally { setSaving(false) }
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
  const isDefaultLayout = selectedLayout?.id === settings?.defaultLayoutId
  const selectedPlacement = placements.find(
    (item) => item.rentalAssetId === selectedPlacementId,
  ) ?? null

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
              <Select
                modal={false}
                value={selectedId === "new" ? "new" : selectedId || null}
                onValueChange={(value) => {
                  if (value === "new") {
                    startCreate()
                    return
                  }
                  if (typeof value === "string") {
                    void selectLayout(value)
                  }
                }}
                items={[
                  ...(selectedId === "new"
                    ? [
                        {
                          value: "new",
                          label: t("rentals.layout.newDraft"),
                        },
                      ]
                    : []),
                  ...layouts.map((layout) => ({
                    value: layout.id,
                    label: `${layout.name}${
                      layout.isActive
                        ? ""
                        : ` (${t("rentals.layout.inactive")})`
                    }`,
                  })),
                ]}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("rentals.layout.empty")} />
                </SelectTrigger>
                <SelectContent>
                  {selectedId === "new" ? (
                    <SelectItem value="new">
                      {t("rentals.layout.newDraft")}
                    </SelectItem>
                  ) : null}
                  {layouts.map((layout) => (
                    <SelectItem key={layout.id} value={layout.id}>
                      {layout.name}
                      {layout.isActive
                        ? ""
                        : ` (${t("rentals.layout.inactive")})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                      markEdited()
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
                      markEdited()
                      setIsActive(Boolean(checked))
                    }}
                  />
                </label>
              </div>

              {settings ? (
                <section className="grid gap-3 rounded-lg border p-3 text-sm sm:grid-cols-2">
                  <div className="flex items-center gap-2 sm:col-span-2">
                    <span className="font-medium">{t("resourceVisual.mapSettings")}</span>
                    {isDefaultLayout ? <Badge variant="success">{t("resourceVisual.defaultMap")}</Badge> : null}
                  </div>
                  <p className="text-xs text-muted-foreground sm:col-span-2">{t("resourceVisual.mapSettingsHelp")}</p>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={settings.showPriceOnBlock} onChange={(event) => void saveSettings({ showPriceOnBlock: event.target.checked })} disabled={isTrialReadOnly || saving}/>{t("resourceVisual.showPrice")}</label>
                  <label>{t("resourceVisual.defaultView")}<Select modal={false} value={settings.defaultView} onValueChange={(value) => { if (value === "Map" || value === "List") void saveSettings({ defaultView: value }) }} items={[{ value: "Map", label: t("bookingMap.map") }, { value: "List", label: t("bookingMap.list") }]}><SelectTrigger className="mt-1 w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Map">{t("bookingMap.map")}</SelectItem><SelectItem value="List">{t("bookingMap.list")}</SelectItem></SelectContent></Select></label>
                  <label>{t("resourceVisual.timeFilter")}<Select modal={false} value={settings.timeFilterMode} onValueChange={(value) => { if (value === "Periods" || value === "FromTime") void saveSettings({ timeFilterMode: value }) }} items={[{ value: "Periods", label: t("bookingMap.periods") }, { value: "FromTime", label: t("resourceVisual.fromTime") }]}><SelectTrigger className="mt-1 w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Periods">{t("bookingMap.periods")}</SelectItem><SelectItem value="FromTime">{t("resourceVisual.fromTime")}</SelectItem></SelectContent></Select></label>
                  <label>{t("resourceVisual.availableColor")}<Input type="color" value={settings.availableColor} onChange={(event) => void saveSettings({ availableColor: event.target.value })}/></label>
                  <label>{t("resourceVisual.takenColor")}<Input type="color" value={settings.takenColor} onChange={(event) => void saveSettings({ takenColor: event.target.value })}/></label>
                  <div className="space-y-1"><Button type="button" variant="outline" title={isDefaultLayout ? t("resourceVisual.alreadyDefault") : undefined} disabled={isTrialReadOnly || saving || isDefaultLayout || !selectedLayout} onClick={() => void saveSettings({ defaultLayoutId: selectedLayout?.id ?? null })}>{t("resourceVisual.setDefaultMap")}</Button>{isDefaultLayout ? <p className="text-xs text-muted-foreground">{t("resourceVisual.alreadyDefault")}</p> : null}</div>
                </section>
              ) : null}

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
                    selected: item.rentalAssetId === selectedPlacementId,
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
                  onSelect={setSelectedPlacementId}
                  onFrameResize={(nextAspect, nextWidth) => {
                    markEdited()
                    setAspectRatio(nextAspect)
                    setCanvasWidthPercent(nextWidth)
                  }}
                  onRemove={isTrialReadOnly ? undefined : removeAsset}
                />
                <div className="space-y-2">
                  {selectedPlacement ? (
                    <fieldset className="space-y-2 rounded-lg border p-3">
                      <legend className="px-1 text-sm font-medium">{t("rentals.layout.blockSize")}</legend>
                      <div className="grid grid-cols-2 gap-2">
                        <label className="space-y-1 text-xs"><span>{t("rentals.layout.width")}</span><Input type="number" min="8" max="100" value={selectedPlacement.widthPercent} disabled={isTrialReadOnly} onChange={(event) => patchPlacement(selectedPlacement.rentalAssetId, { widthPercent: Number(event.target.value) })}/></label>
                        <label className="space-y-1 text-xs"><span>{t("rentals.layout.height")}</span><Input type="number" min="8" max="100" value={selectedPlacement.heightPercent} disabled={isTrialReadOnly} onChange={(event) => patchPlacement(selectedPlacement.rentalAssetId, { heightPercent: Number(event.target.value) })}/></label>
                      </div>
                      <div className="flex flex-wrap gap-1"><Button type="button" size="sm" variant="outline" disabled={isTrialReadOnly} onClick={() => patchPlacement(selectedPlacement.rentalAssetId, { widthPercent: 20, heightPercent: 10 })}>{t("rentals.layout.courtPreset")}</Button><Button type="button" size="sm" variant="outline" disabled={isTrialReadOnly} onClick={() => patchPlacement(selectedPlacement.rentalAssetId, { widthPercent: 16, heightPercent: 16 })}>{t("rentals.layout.squarePreset")}</Button><Button type="button" size="sm" variant="outline" disabled={isTrialReadOnly} onClick={() => patchPlacement(selectedPlacement.rentalAssetId, { widthPercent: 32, heightPercent: 8 })}>{t("rentals.layout.stripPreset")}</Button></div>
                    </fieldset>
                  ) : null}
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
                  {t(saveState === "saved" ? "rentals.layout.saved" : "rentals.layout.save")}
                </LoadingButton>
                <Button
                  type="button"
                  variant="outline"
                  disabled={saving || isTrialReadOnly || placements.length === 0}
                  onClick={organizeEvenly}
                >
                  {t("rentals.layout.organize")}
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
