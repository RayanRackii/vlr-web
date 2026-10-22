import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { ErrorState } from "@/components/ErrorState"
import { SaveStatus } from "@/components/SaveStatus"
import { Wizard, type WizardStep } from "@/components/wizard/Wizard"
import { PageContentSkeleton } from "@/components/loading/PageContentSkeleton"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { RentalResourceSheet } from "@/features/rentals/components/RentalResourceSheet"
import { LayoutCanvasBoard } from "@/features/rentals/components/layout/LayoutCanvasBoard"
import { arrangeEvenly, autoPlaceItems, DEFAULT_ASPECT_RATIO, DEFAULT_CANVAS_WIDTH_PERCENT, fitPlacement, type LayoutPlacement } from "@/features/rentals/components/layout/layoutCanvasModel"
import type { AssetFamily } from "@/features/assets/schemas/assetFamilySchemas"
import type { Unit } from "@/features/assets/schemas/unitSchemas"
import { getUnits } from "@/features/assets/services/unitsService"
import { toCreateRentableRequest, type RegistryCategoryListItem, type RentalResourceFormValues } from "@/features/rentals/schemas/rentalResourceSchemas"
import { createRentalAsset, listRentalAssetCategories, listRentalAssetFamilies } from "@/features/rentals/services/rentalResourcesService"
import { createRentalLayout, deleteRentalLayout, listRentalLayouts, type RentalLayout } from "@/features/rentals/services/rentalLayoutService"
import { getBookingMapSettings, getComposition, listVisualTemplates, saveBookingMapSettings, saveComposition, type BookingMapSettings, type MapComposition, type VisualTemplate } from "@/features/rentals/services/resourceVisualService"
import { listAdminRentalAssets, type AdminRentalAsset } from "@/features/rentals/services/scheduleService"
import { useTrialStatus } from "@/features/users/hooks/useTrialStatus"
import { useSavedState } from "@/hooks/useSavedState"

export function RentalLayoutsPage() {
  const { t, i18n } = useTranslation()
  const { isTrialReadOnly } = useTrialStatus()
  const [layouts, setLayouts] = useState<RentalLayout[]>([])
  const [assets, setAssets] = useState<AdminRentalAsset[]>([])
  const [templates, setTemplates] = useState<VisualTemplate[]>([])
  const [selectedId, setSelectedId] = useState<string | "new" | "">("")
  const [name, setName] = useState("")
  const [isActive, setIsActive] = useState(true)
  const [placements, setPlacements] = useState<LayoutPlacement[]>([])
  const [templateByAssetId, setTemplateByAssetId] = useState<Record<string, string | null>>({})
  const [aspectRatio, setAspectRatio] = useState(DEFAULT_ASPECT_RATIO)
  const [canvasWidthPercent, setCanvasWidthPercent] = useState(DEFAULT_CANVAS_WIDTH_PERCENT)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState<BookingMapSettings | null>(null)
  const [composition, setComposition] = useState<MapComposition | null>(null)
  const [selectedPlacementId, setSelectedPlacementId] = useState<string | null>(null)
  const [saveValidationError, setSaveValidationError] = useState<string | null>(null)
  const [resourceSheetOpen, setResourceSheetOpen] = useState(false)
  const [categories, setCategories] = useState<RegistryCategoryListItem[]>([])
  const [families, setFamilies] = useState<AssetFamily[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const { saveState, markSaving, markSaved, markError, markEdited } = useSavedState()

  const selectedLayout = selectedId && selectedId !== "new" ? layouts.find((item) => item.id === selectedId) ?? null : null
  const assetNameById = useMemo(() => new Map(assets.map((asset) => [asset.id, asset.name])), [assets])
  const placedIds = useMemo(() => new Set(placements.map((item) => item.rentalAssetId)), [placements])
  const selectedPlacement = placements.find((item) => item.rentalAssetId === selectedPlacementId) ?? null
  const isDefaultLayout = selectedLayout?.id === settings?.defaultLayoutId

  function applyLayout(layout: RentalLayout, loaded?: MapComposition) {
    const items = loaded?.items ?? layout.items
    setSelectedId(layout.id); setName(layout.name); setIsActive(layout.isActive)
    setPlacements(items.map((item) => fitPlacement(item)))
    setTemplateByAssetId(loaded ? Object.fromEntries(loaded.items.map((item) => [item.rentalAssetId, item.visualTemplateRevisionId])) : {})
    setAspectRatio(layout.aspectRatio); setCanvasWidthPercent(layout.widthPercent)
    setComposition(loaded ?? null); setSelectedPlacementId(null); markEdited()
  }
  function resetEditor() {
    setSelectedId(""); setName(""); setIsActive(true); setPlacements([]); setTemplateByAssetId({})
    setAspectRatio(DEFAULT_ASPECT_RATIO); setCanvasWidthPercent(DEFAULT_CANVAS_WIDTH_PERCENT)
    setComposition(null); setSelectedPlacementId(null); setSaveValidationError(null)
  }
  const applyLayoutRef = useRef(applyLayout)
  useEffect(() => { applyLayoutRef.current = applyLayout })

  const load = useCallback(async () => {
    setLoading(true); setLoadError(null)
    try {
      const [layoutList, assetList, templatePage] = await Promise.all([listRentalLayouts(), listAdminRentalAssets(), listVisualTemplates()])
      setLayouts(layoutList); setAssets(assetList); setTemplates(templatePage.items.filter((item) => item.publishedRevision))
      void getBookingMapSettings().then(setSettings).catch(() => setSettings(null))
      if (layoutList[0]) applyLayoutRef.current(layoutList[0], await getComposition(layoutList[0].id))
      else resetEditor()
    } catch (error) { setLoadError(error instanceof Error ? error.message : t("rentals.layout.loadError")) }
    finally { setLoading(false) }
  }, [t])
  useEffect(() => { void load() }, [load])

  function startCreate() {
    setSelectedId("new"); setName(t("rentals.layout.defaultName")); setIsActive(true); setPlacements([]); setTemplateByAssetId({})
    setAspectRatio(DEFAULT_ASPECT_RATIO); setCanvasWidthPercent(DEFAULT_CANVAS_WIDTH_PERCENT); setComposition(null); setSelectedPlacementId(null); setSaveValidationError(null); markEdited()
  }
  async function selectLayout(id: string) {
    const layout = layouts.find((item) => item.id === id)
    if (!layout) return
    try { applyLayout(layout, await getComposition(id)) } catch (error) { toast.error(error instanceof Error ? error.message : t("rentals.layout.loadError")) }
  }
  function toggleAsset(asset: AdminRentalAsset) {
    markEdited()
    if (placedIds.has(asset.id)) { setPlacements((current) => current.filter((item) => item.rentalAssetId !== asset.id)); return }
    const placement = autoPlaceItems([...placements.map((item) => item.rentalAssetId), asset.id]).at(-1)
    if (placement) setPlacements((current) => [...current, { ...placement, zIndex: current.length }])
  }
  function patchPlacement(id: string, patch: Partial<LayoutPlacement>) {
    markEdited(); setPlacements((current) => current.map((item) => item.rentalAssetId === id ? fitPlacement({ ...item, ...patch }) : item))
  }
  function removeAsset(id: string) { markEdited(); setPlacements((current) => current.filter((item) => item.rentalAssetId !== id)); setSelectedPlacementId(null) }
  function payload(current: MapComposition) {
    const originals = new Map(current.items.map((item) => [item.rentalAssetId, item]))
    return { expectedVersion: current.version, unitId: current.unitId, name: name.trim(), isActive, sortOrder: current.sortOrder, aspectRatio, widthPercent: canvasWidthPercent, decorations: current.decorations,
      items: placements.map((placement) => { const original = originals.get(placement.rentalAssetId); const hasTemplateOverride = Object.hasOwn(templateByAssetId, placement.rentalAssetId); return { ...fitPlacement(placement), id: original?.id, rotation: original?.rotation ?? 0, lockAspectRatio: original?.lockAspectRatio ?? true, visualTemplateRevisionId: hasTemplateOverride ? templateByAssetId[placement.rentalAssetId] : original?.visualTemplateRevisionId ?? null } }) }
  }
  async function save() {
    if (!placements.length) { setSaveValidationError(t("rentals.layout.validation.spaces")); return }
    if (!name.trim()) { setSaveValidationError(t("rentals.layout.nameRequired")); return }
    if (selectedId !== "new" && (!composition || !selectedLayout)) { toast.error(t("rentals.layout.saveError")); return }
    setSaveValidationError(null)
    setSaving(true); markSaving(); const position = { x: window.scrollX, y: window.scrollY }
    try {
      const body = { name: name.trim(), isActive, aspectRatio, widthPercent: canvasWidthPercent, items: placements.map(fitPlacement) }
      if (selectedId === "new") {
        const created = await createRentalLayout(body); const saved = await saveComposition(created.id, payload(await getComposition(created.id)))
        setLayouts((current) => [...current.filter((item) => item.id !== created.id), created]); applyLayout(created, saved); toast.success(t("rentals.layout.createSuccess"))
      } else if (composition && selectedLayout) {
        const saved = await saveComposition(selectedId, payload(composition)); const updated = { ...selectedLayout, ...saved, items: saved.items }
        setLayouts((current) => current.map((item) => item.id === updated.id ? updated : item)); applyLayout(updated, saved); toast.success(t("rentals.layout.updateSuccess"))
      }
      markSaved(); requestAnimationFrame(() => window.scrollTo(position.x, position.y))
    } catch (error) { markError(); toast.error(error instanceof Error ? error.message : t("rentals.layout.saveError")) }
    finally { setSaving(false) }
  }
  async function saveSettings(patch: Partial<BookingMapSettings>) {
    if (!settings || isTrialReadOnly || saving) return
    setSaving(true); markSaving()
    try { setSettings(await saveBookingMapSettings({ ...settings, ...patch, expectedVersion: settings.version })); markSaved(); toast.success(t("resourceVisual.saved")) }
    catch (error) { markError(); toast.error(error instanceof Error ? error.message : t("rentals.layout.saveError")) }
    finally { setSaving(false) }
  }
  async function removeLayout() {
    if (!selectedLayout) return
    setSaving(true)
    try { await deleteRentalLayout(selectedLayout.id); toast.success(t("rentals.layout.deleteSuccess")); await load() }
    catch (error) { toast.error(error instanceof Error ? error.message : t("rentals.layout.deleteError")) }
    finally { setSaving(false) }
  }
  async function openResourceCreate() {
    try {
      const [categoryList, familyList, unitList] = await Promise.all([listRentalAssetCategories(), listRentalAssetFamilies(), getUnits()])
      setCategories(categoryList); setFamilies(familyList); setUnits(unitList); setResourceSheetOpen(true)
    } catch (error) { toast.error(error instanceof Error ? error.message : t("rentals.resources.loadError")) }
  }
  async function createResource(values: RentalResourceFormValues, options: { applyTemplateDefaults: boolean }): Promise<boolean> {
    setSaving(true)
    try {
      const created = await createRentalAsset(toCreateRentableRequest(values, { creating: true, stored: undefined, applyTemplateDefaults: options.applyTemplateDefaults }))
      setAssets((current) => [...current, created])
      setPlacements((current) => {
        const placement = autoPlaceItems([...current.map((item) => item.rentalAssetId), created.id]).at(-1)
        return placement ? [...current, { ...placement, zIndex: current.length }] : current
      })
      setResourceSheetOpen(false); toast.success(t("rentals.resources.createSuccess")); return true
    } catch (error) { toast.error(error instanceof Error ? error.message : t("rentals.resources.createError")); return false }
    finally { setSaving(false) }
  }

  const steps: WizardStep[] = [
    { id: "spaces", label: t("rentals.layout.steps.spaces"), validate: () => placements.length ? null : t("rentals.layout.validation.spaces") },
    { id: "templates", label: t("rentals.layout.steps.templates") },
    { id: "map", label: t("rentals.layout.steps.map") },
    { id: "review", label: t("rentals.layout.steps.review"), validate: () => name.trim() ? null : t("rentals.layout.nameRequired") },
  ]
  const templateName = (template: VisualTemplate) => template.nameI18n[i18n.language] ?? template.nameI18n["pt-BR"] ?? template.slug

  function editorStep(index: number) {
    if (index === 0) return <section className="space-y-4"><div><h2 className="font-medium">{t("rentals.layout.spacesTitle")}</h2><p className="text-sm text-muted-foreground">{t("rentals.layout.spacesHelp")}</p></div><Button type="button" variant="outline" disabled={isTrialReadOnly} onClick={() => void openResourceCreate()}>{t("rentals.layout.createSpace")}</Button><ul className="grid gap-2 sm:grid-cols-2">{assets.map((asset) => <li key={asset.id}><label className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm"><input type="checkbox" checked={placedIds.has(asset.id)} disabled={isTrialReadOnly} onChange={() => toggleAsset(asset)} /><span><span className="block font-medium">{asset.name}</span><span className="text-xs text-muted-foreground">{asset.type === "Location" ? t("rentals.layout.spaceType") : t("rentals.layout.bookableItemType")}</span></span></label></li>)}</ul></section>
    if (index === 1) return <section className="space-y-4"><div><h2 className="font-medium">{t("rentals.layout.templatesTitle")}</h2><p className="text-sm text-muted-foreground">{t("rentals.layout.templatesHelp")}</p></div>{placements.map((placement) => <label key={placement.rentalAssetId} className="grid gap-2 rounded-lg border p-3 text-sm sm:grid-cols-[1fr_minmax(12rem,1fr)] sm:items-center"><span className="font-medium">{assetNameById.get(placement.rentalAssetId) ?? placement.rentalAssetId}</span><Select modal={false} value={templateByAssetId[placement.rentalAssetId] ?? "none"} disabled={isTrialReadOnly} onValueChange={(value) => { markEdited(); setTemplateByAssetId((current) => ({ ...current, [placement.rentalAssetId]: value === "none" ? null : value })) }} items={[{ value: "none", label: t("resourceVisual.noTemplate") }, ...templates.map((template) => ({ value: template.publishedRevision?.id ?? "", label: templateName(template) }))]}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">{t("resourceVisual.noTemplate")}</SelectItem>{templates.map((template) => <SelectItem key={template.id} value={template.publishedRevision?.id ?? ""}>{templateName(template)}</SelectItem>)}</SelectContent></Select></label>)}</section>
    return <section className="space-y-4"><div><h2 className="font-medium">{t("rentals.layout.mapTitle")}</h2><p className="text-sm text-muted-foreground">{t("rentals.layout.mapHelp")}</p></div><div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_16rem]"><LayoutCanvasBoard mode="edit" aspectRatio={aspectRatio} canvasWidthPercent={canvasWidthPercent} items={placements.map((item) => ({ ...item, key: item.rentalAssetId, label: assetNameById.get(item.rentalAssetId) ?? item.rentalAssetId, selected: item.rentalAssetId === selectedPlacementId }))} onMove={(id, x, y) => patchPlacement(id, { xPercent: x, yPercent: y })} onResize={(id, width, height) => patchPlacement(id, { widthPercent: width, heightPercent: height })} onSelect={setSelectedPlacementId} onFrameResize={(nextAspect, nextWidth) => { markEdited(); setAspectRatio(nextAspect); setCanvasWidthPercent(nextWidth) }} onRemove={isTrialReadOnly ? undefined : removeAsset} /><aside className="space-y-3">{selectedPlacement ? <fieldset className="space-y-2 rounded-lg border p-3"><legend className="px-1 text-sm font-medium">{t("rentals.layout.blockSize")}</legend><div className="grid grid-cols-2 gap-2"><label className="text-xs">{t("rentals.layout.width")}<Input type="number" min="8" max="100" value={selectedPlacement.widthPercent} onChange={(event) => patchPlacement(selectedPlacement.rentalAssetId, { widthPercent: Number(event.target.value) })} /></label><label className="text-xs">{t("rentals.layout.height")}<Input type="number" min="8" max="100" value={selectedPlacement.heightPercent} onChange={(event) => patchPlacement(selectedPlacement.rentalAssetId, { heightPercent: Number(event.target.value) })} /></label></div><div className="flex flex-wrap gap-1"><Button type="button" size="sm" variant="outline" onClick={() => patchPlacement(selectedPlacement.rentalAssetId, { widthPercent: 20, heightPercent: 10 })}>{t("rentals.layout.widePreset")}</Button><Button type="button" size="sm" variant="outline" onClick={() => patchPlacement(selectedPlacement.rentalAssetId, { widthPercent: 16, heightPercent: 16 })}>{t("rentals.layout.squarePreset")}</Button><Button type="button" size="sm" variant="outline" onClick={() => patchPlacement(selectedPlacement.rentalAssetId, { widthPercent: 32, heightPercent: 8 })}>{t("rentals.layout.stripPreset")}</Button></div></fieldset> : null}<Button type="button" variant="outline" disabled={!placements.length || isTrialReadOnly} onClick={() => { markEdited(); setPlacements(arrangeEvenly(placements.map((item) => item.rentalAssetId))) }}>{t("rentals.layout.organize")}</Button><p className="text-xs text-muted-foreground">{t("rentals.layout.paletteHelp")}</p></aside></div></section>
  }

  return <div className="mx-auto w-full max-w-6xl space-y-6 p-6"><div className="space-y-1"><h1 className="text-2xl font-semibold tracking-tight">{t("rentals.layout.title")}</h1><p className="text-sm text-muted-foreground">{t("rentals.layout.description")}</p></div>{isTrialReadOnly ? <p role="status" className="text-sm text-amber-800">{t("trial.readOnlyHint")}</p> : null}{loading ? <PageContentSkeleton rows={4} /> : loadError ? <ErrorState message={loadError} onRetry={() => void load()} /> : <><div className="flex flex-col gap-3 sm:flex-row sm:items-end"><label className="flex-1 space-y-1 text-sm"><span>{t("rentals.layout.select")}</span><Select modal={false} value={selectedId === "new" ? "new" : selectedId || null} onValueChange={(value) => value === "new" ? startCreate() : typeof value === "string" ? void selectLayout(value) : undefined} items={layouts.map((item) => ({ value: item.id, label: item.name }))}><SelectTrigger className="w-full"><SelectValue placeholder={t("rentals.layout.empty")} /></SelectTrigger><SelectContent>{selectedId === "new" ? <SelectItem value="new">{t("rentals.layout.newDraft")}</SelectItem> : null}{layouts.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></label><Button type="button" variant="outline" disabled={isTrialReadOnly} onClick={startCreate}>{t("rentals.layout.create")}</Button></div>{selectedId ? <div className="space-y-4"><SaveStatus state={saveState} /><Wizard key={selectedId} steps={steps} initialStep={selectedLayout ? 2 : 0} nextLabel={t("rentals.layout.next")} backLabel={t("rentals.layout.back")} finishLabel={t(saveState === "saved" ? "rentals.layout.saved" : "rentals.layout.save")} onFinish={save} finishDisabled={isTrialReadOnly || !name.trim()} busy={saving} finalReview={<div className="space-y-4 rounded-lg border p-4"><div className="flex justify-between gap-3"><div><p className="font-medium">{name}</p><p className="text-sm text-muted-foreground">{t("rentals.layout.reviewSpaces", { count: placements.length })}</p></div><Badge variant={isActive ? "success" : "secondary"}>{isActive ? t("rentals.layout.active") : t("rentals.layout.inactive")}</Badge></div>{isDefaultLayout ? <Badge variant="success">{t("resourceVisual.defaultMap")}</Badge> : null}{saveValidationError ? <p role="alert" className="text-sm text-destructive">{saveValidationError}</p> : null}<label className="space-y-1 text-sm"><span>{t("rentals.layout.name")}</span><Input value={name} onChange={(event) => { markEdited(); setName(event.target.value) }} /></label><label className="flex items-center justify-between rounded-lg border p-3 text-sm"><span>{t("rentals.layout.active")}</span><Switch checked={isActive} onCheckedChange={(checked) => { markEdited(); setIsActive(Boolean(checked)) }} /></label></div>}>{editorStep}</Wizard><details className="rounded-lg border p-3"><summary className="cursor-pointer font-medium">{t("rentals.layout.advanced")}</summary>{settings ? <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2"><label className="flex items-center gap-2"><input type="checkbox" checked={settings.showPriceOnBlock} disabled={isTrialReadOnly || saving} onChange={(event) => void saveSettings({ showPriceOnBlock: event.target.checked })} />{t("resourceVisual.showPrice")}</label><label>{t("resourceVisual.defaultView")}<Select modal={false} value={settings.defaultView} onValueChange={(value) => { if (value === "Map" || value === "List") void saveSettings({ defaultView: value }) }} items={[{ value: "Map", label: t("bookingMap.map") }, { value: "List", label: t("bookingMap.list") }]}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Map">{t("bookingMap.map")}</SelectItem><SelectItem value="List">{t("bookingMap.list")}</SelectItem></SelectContent></Select></label><label>{t("resourceVisual.timeFilter")}<Select modal={false} value={settings.timeFilterMode} onValueChange={(value) => { if (value === "Periods" || value === "FromTime") void saveSettings({ timeFilterMode: value }) }} items={[{ value: "Periods", label: t("bookingMap.periods") }, { value: "FromTime", label: t("resourceVisual.fromTime") }]}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Periods">{t("bookingMap.periods")}</SelectItem><SelectItem value="FromTime">{t("resourceVisual.fromTime")}</SelectItem></SelectContent></Select></label><label>{t("resourceVisual.availableColor")}<Input type="color" value={settings.availableColor} onChange={(event) => void saveSettings({ availableColor: event.target.value })} /></label><label>{t("resourceVisual.takenColor")}<Input type="color" value={settings.takenColor} onChange={(event) => void saveSettings({ takenColor: event.target.value })} /></label><Button type="button" variant="outline" disabled={!selectedLayout || isDefaultLayout || isTrialReadOnly || saving} onClick={() => void saveSettings({ defaultLayoutId: selectedLayout?.id ?? null })}>{t("resourceVisual.setDefaultMap")}</Button></div> : null}</details>{selectedLayout ? <Button type="button" variant="destructive" disabled={saving || isTrialReadOnly} onClick={() => void removeLayout()}>{t("common.delete")}</Button> : null}</div> : <p className="text-sm text-muted-foreground">{t("rentals.layout.emptyHint")}</p>}<RentalResourceSheet open={resourceSheetOpen} onOpenChange={setResourceSheetOpen} editing={null} units={units} categories={categories} families={families} busy={saving} readOnly={isTrialReadOnly} onSubmit={createResource} /></>}</div>
}
