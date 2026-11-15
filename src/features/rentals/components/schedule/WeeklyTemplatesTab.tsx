import { CalendarRange, ChevronDown, ChevronRight } from "lucide-react"
import { useMemo, useState, type ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"

import { Button } from "@/components/ui/button"
import {
  BusinessHoursEditor,
  type BusinessHoursSaveResult,
} from "@/features/rentals/components/schedule/BusinessHoursEditor"
import type { BusinessHoursPlan } from "@/features/rentals/components/schedule/businessHoursModel"
import type { ScheduleBusyAction } from "@/features/rentals/components/schedule/DailyAgendaTab"
import { DayResourceGrid } from "@/features/rentals/components/schedule/DayResourceGrid"
import { ScheduleDaySlotsSkeleton } from "@/features/rentals/components/schedule/ScheduleDaySlotsSkeleton"
import { ScheduleEmptyState } from "@/features/rentals/components/schedule/ScheduleEmptyState"
import {
  buildWeeklyGridOccupancies,
  isOpenHoursOccupancyId,
  resolveScheduleSurface,
} from "@/features/rentals/components/schedule/scheduleGridModel"
import { scheduleChipClassName } from "./scheduleChipClassName"
import {
  DAY_NAMES,
  type AdminRentalAsset,
  type DayOfWeekName,
  type OccupancyKind,
  type ScheduleTemplate,
} from "@/features/rentals/services/scheduleService"

export type WeeklyGridCellPayload = {
  rentalAssetId: string
  assetName: string
  dayOfWeek: DayOfWeekName
  startTime: string
  endTime: string
  origin: "template" | "openHours" | "empty"
  template: ScheduleTemplate | null
}

type WeeklyTemplatesTabProps = {
  assets: readonly AdminRentalAsset[]
  selectedRentalAssetIds: readonly string[]
  weekday: DayOfWeekName
  templates: readonly ScheduleTemplate[]
  scheduleTemplates: readonly ScheduleTemplate[]
  loadingScheduleTemplates: boolean
  kinds: readonly OccupancyKind[]
  loading: boolean
  showSkeleton: boolean
  busy: boolean
  busyAction: ScheduleBusyAction
  busyTargetId: string | null
  readOnly: boolean
  onSelectedRentalAssetIdsChange: (ids: string[]) => void
  onWeekdayChange: (weekday: DayOfWeekName) => void
  onCellClick: (payload: WeeklyGridCellPayload) => void
  onSaveBusinessHours: (plan: BusinessHoursPlan) => Promise<BusinessHoursSaveResult>
  onHoursDirtyChange?: (dirty: boolean) => void
  templateEditor?: ReactNode
}

function previewOpenByDefault(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return true
  return window.matchMedia("(min-width: 768px)").matches
}

export function WeeklyTemplatesTab({
  assets,
  selectedRentalAssetIds,
  weekday,
  templates,
  scheduleTemplates,
  loadingScheduleTemplates,
  kinds,
  loading,
  showSkeleton,
  busy,
  busyAction,
  busyTargetId,
  readOnly,
  onSelectedRentalAssetIdsChange,
  onWeekdayChange,
  onCellClick,
  onSaveBusinessHours,
  onHoursDirtyChange,
  templateEditor,
}: WeeklyTemplatesTabProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [previewOpen, setPreviewOpen] = useState(previewOpenByDefault)

  const selectedAssets = useMemo(
    () => assets.filter((asset) => selectedRentalAssetIds.includes(asset.id)),
    [assets, selectedRentalAssetIds],
  )

  const occupancies = useMemo(
    () => buildWeeklyGridOccupancies(selectedAssets, templates, kinds, weekday),
    [kinds, selectedAssets, templates, weekday],
  )

  const surface = resolveScheduleSurface({
    loading,
    showSkeleton,
    assetCount: assets.length,
    selectedCount: selectedAssets.length,
  })

  if (surface === "page-skeleton") {
    return (
      <div role="status" aria-live="polite">
        <p className="sr-only">{t("common.loading")}</p>
        <ScheduleDaySlotsSkeleton />
      </div>
    )
  }

  if (surface === "no-assets") {
    return (
      <ScheduleEmptyState
        icon={CalendarRange}
        title={t("rentals.schedule.noAssets")}
        description={t("rentals.schedule.noAssetsDescription")}
        actionLabel={t("rentals.schedule.noAssetsAction")}
        onAction={() => {
          void navigate("/configuracoes/recursos")
        }}
      />
    )
  }

  const showInlineRefresh = loading && surface === "grid"
  const hasSelection = selectedAssets.length > 0
  const PreviewChevron = previewOpen ? ChevronDown : ChevronRight

  return (
    <div className="w-full space-y-8">
      <BusinessHoursEditor
        assets={assets}
        selectedRentalAssetIds={selectedRentalAssetIds}
        scheduleTemplates={scheduleTemplates}
        loadingTemplates={loadingScheduleTemplates}
        busy={busy}
        busyAction={busyAction}
        readOnly={readOnly}
        onSelectedRentalAssetIdsChange={onSelectedRentalAssetIdsChange}
        onSave={onSaveBusinessHours}
        onDirtyChange={onHoursDirtyChange}
      />

      <section className="min-w-0 space-y-3" aria-labelledby="weekly-preview-title">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 id="weekly-preview-title" className="text-base font-semibold">
              {t("rentals.schedule.hours.preview")}
            </h2>
            <p className="text-xs text-muted-foreground">{t("rentals.schedule.hours.previewHint")}</p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-expanded={previewOpen}
            aria-controls="weekly-preview-body"
            onClick={() => setPreviewOpen((open) => !open)}
          >
            <PreviewChevron aria-hidden />
            {previewOpen ? t("rentals.schedule.hours.previewHide") : t("rentals.schedule.hours.previewShow")}
          </Button>
        </div>

        <div id="weekly-preview-body" hidden={!previewOpen} className="min-w-0 space-y-3">
          {previewOpen ? (
            <>
              <div role="group" aria-label={t("rentals.schedule.templates.dayOfWeek")} className="flex flex-wrap gap-2">
                {DAY_NAMES.map((dayName) => (
                  <button
                    key={dayName}
                    type="button"
                    aria-pressed={weekday === dayName}
                    onClick={() => onWeekdayChange(dayName)}
                    className={scheduleChipClassName(weekday === dayName)}
                  >
                    {t(`rentals.schedule.days.${dayName}`)}
                  </button>
                ))}
              </div>
              {showInlineRefresh ? (
                <p className="sr-only" role="status" aria-live="polite">
                  {t("common.refreshing")}
                </p>
              ) : null}
              {!hasSelection || surface === "no-selection" ? (
                <ScheduleEmptyState icon={CalendarRange} title={t("rentals.schedule.grid.noSelection")} />
              ) : surface === "grid-skeleton" ? (
                <div role="status" aria-live="polite">
                  <p className="sr-only">{t("common.loading")}</p>
                  <ScheduleDaySlotsSkeleton columns={Math.min(selectedAssets.length, 5)} />
                </div>
              ) : (
                <DayResourceGrid
                  assets={selectedAssets}
                  occupancies={occupancies}
                  busyTargetKey={busyTargetId}
                  readOnly={readOnly}
                  onCellClick={(cell) => {
                    const asset = selectedAssets.find((item) => item.id === cell.rentalAssetId)
                    const policy = asset?.schedulePolicy ?? "SlotGrid"
                    // Open-hours resources keep their hours on the resource; the editor above changes them.
                    if (policy === "OpenHours" || (cell.occupancy && isOpenHoursOccupancyId(cell.occupancy.id))) {
                      return
                    }
                    const template = cell.occupancy
                      ? (templates.find((row) => row.id === cell.occupancy?.id) ?? null)
                      : null
                    onCellClick({
                      rentalAssetId: cell.rentalAssetId,
                      assetName: cell.assetName,
                      dayOfWeek: weekday,
                      startTime: cell.startTime,
                      endTime: cell.endTime,
                      origin: template ? "template" : "empty",
                      template,
                    })
                  }}
                />
              )}
            </>
          ) : null}
        </div>
        {templateEditor}
      </section>
    </div>
  )
}
