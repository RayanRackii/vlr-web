import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import {
  DailyAgendaTab,
  type ScheduleBusyAction,
} from "@/features/rentals/components/schedule/DailyAgendaTab"
import type { DayResourceGridCellPayload } from "@/features/rentals/components/schedule/DayResourceGrid"
import {
  DaySlotSheet,
  type DaySlotDraft,
} from "@/features/rentals/components/schedule/DaySlotSheet"
import { OccupancyKindSheet } from "@/features/rentals/components/schedule/OccupancyKindSheet"
import { OccupancyKindsTab } from "@/features/rentals/components/schedule/OccupancyKindsTab"
import { todayIsoDate } from "@/features/rentals/components/schedule/scheduleFormDefaults"
import type { TemplateDraft } from "@/features/rentals/components/schedule/scheduleFormDefaults"
import { TemplateSheet } from "@/features/rentals/components/schedule/TemplateSheet"
import { WeeklyTemplatesTab } from "@/features/rentals/components/schedule/WeeklyTemplatesTab"
import type { WeeklyRuleDraft } from "@/features/rentals/components/schedule/WeeklyTemplatesTab"
import {
  applyDailyOccurrence,
  applyWeeklyRule,
  createOccupancyKind,
  createScheduleTemplate,
  deleteScheduleTemplate,
  fetchAdminScheduleDay,
  formatScheduleTime,
  listAdminRentalAssets,
  listOccupancyKinds,
  listScheduleTemplates,
  publishScheduleDay,
  seedDefaultHourlyTemplates,
  updateOccupancyKind,
  updateRentalSchedulePolicyBulk,
  updateScheduleTemplate,
  type AdminDaySchedule,
  type AdminDaySlot,
  type AdminRentalAsset,
  type OccupancyKind,
  type OccurrenceEditScope,
  type ScheduleTemplate,
  type UpdateSchedulePolicyInput,
  type UpsertOccupancyKindInput,
} from "@/features/rentals/services/scheduleService"
import { useTrialStatus } from "@/features/users/hooks/useTrialStatus"
import { cn } from "@/lib/utils"

type ScheduleTab = "daily" | "templates" | "kinds"

function dayCacheKey(rentalAssetIds: readonly string[], date: string): string {
  return `${[...rentalAssetIds].sort().join(",")}|${date}`
}

function mergeAssets(
  current: readonly AdminRentalAsset[],
  updated: readonly AdminRentalAsset[],
): AdminRentalAsset[] {
  if (updated.length === 0) {
    return [...current]
  }
  const byId = new Map(updated.map((asset) => [asset.id, asset]))
  return current.map((asset) => byId.get(asset.id) ?? asset)
}

export function SchedulePage() {
  const { t } = useTranslation()
  const { isTrialReadOnly } = useTrialStatus()

  const [tab, setTab] = useState<ScheduleTab>("daily")
  const [assets, setAssets] = useState<AdminRentalAsset[]>([])
  const [selectedRentalAssetIds, setSelectedRentalAssetIds] = useState<string[]>(
    [],
  )
  const [templateRentalAssetId, setTemplateRentalAssetId] = useState("")
  const [date, setDate] = useState(todayIsoDate())
  const [kinds, setKinds] = useState<OccupancyKind[]>([])
  const [templates, setTemplates] = useState<ScheduleTemplate[]>([])
  const [day, setDay] = useState<AdminDaySchedule | null>(null)
  const [loadingAssets, setLoadingAssets] = useState(true)
  const [loadingKinds, setLoadingKinds] = useState(true)
  const [loadingDay, setLoadingDay] = useState(false)
  const [showDaySkeleton, setShowDaySkeleton] = useState(false)
  const [busy, setBusy] = useState(false)
  const [busyAction, setBusyAction] = useState<ScheduleBusyAction>(null)
  const [busyTargetId, setBusyTargetId] = useState<string | null>(null)

  const loadedDayKeysRef = useRef(new Set<string>())
  const dayCacheRef = useRef(new Map<string, AdminDaySchedule | null>())

  const [kindSheetOpen, setKindSheetOpen] = useState(false)
  const [editingKind, setEditingKind] = useState<OccupancyKind | null>(null)
  const [templateSheetOpen, setTemplateSheetOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] =
    useState<ScheduleTemplate | null>(null)
  const [slotSheetOpen, setSlotSheetOpen] = useState(false)
  const [editingCell, setEditingCell] =
    useState<DayResourceGridCellPayload | null>(null)

  const defaultKindId = useMemo(
    () =>
      kinds.find((kind) => kind.isActive && kind.isBookableByCustomer)?.id ??
      kinds.find((kind) => kind.isActive)?.id ??
      "",
    [kinds],
  )

  function beginBusy(action: Exclude<ScheduleBusyAction, null>, targetId?: string) {
    setBusy(true)
    setBusyAction(action)
    setBusyTargetId(targetId ?? null)
  }

  function endBusy() {
    setBusy(false)
    setBusyAction(null)
    setBusyTargetId(null)
  }

  const loadKinds = useCallback(async () => {
    setLoadingKinds(true)
    try {
      const list = await listOccupancyKinds()
      setKinds(list)
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("rentals.schedule.loadError"),
      )
    } finally {
      setLoadingKinds(false)
    }
  }, [t])

  useEffect(() => {
    void loadKinds()
  }, [loadKinds])

  useEffect(() => {
    let cancelled = false
    setLoadingAssets(true)
    void listAdminRentalAssets()
      .then((assetList) => {
        if (cancelled) {
          return
        }
        setAssets(assetList)
        setSelectedRentalAssetIds((current) => {
          const valid = current.filter((id) =>
            assetList.some((asset) => asset.id === id),
          )
          return valid.length > 0 ? valid : assetList.map((asset) => asset.id)
        })
        setTemplateRentalAssetId((current) =>
          current && assetList.some((asset) => asset.id === current)
            ? current
            : (assetList[0]?.id ?? ""),
        )
      })
      .catch((error) => {
        toast.error(
          error instanceof Error
            ? error.message
            : t("rentals.schedule.loadError"),
        )
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingAssets(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [t])

  const refreshDay = useCallback(async () => {
    if (selectedRentalAssetIds.length === 0 || !date) {
      return
    }
    const key = dayCacheKey(selectedRentalAssetIds, date)
    const daySchedule = await fetchAdminScheduleDay(date, selectedRentalAssetIds)
    setDay(daySchedule)
    loadedDayKeysRef.current.add(key)
    dayCacheRef.current.set(key, daySchedule)
  }, [date, selectedRentalAssetIds])

  const refreshWeeklyTemplates = useCallback(async () => {
    if (!templateRentalAssetId) {
      setTemplates([])
      return
    }
    const list = await listScheduleTemplates(templateRentalAssetId)
    setTemplates(list)
  }, [templateRentalAssetId])

  useEffect(() => {
    if (selectedRentalAssetIds.length === 0 || !date) {
      setDay(null)
      setShowDaySkeleton(false)
      setLoadingDay(false)
      return
    }

    const key = dayCacheKey(selectedRentalAssetIds, date)
    const known = loadedDayKeysRef.current.has(key)
    const cached = dayCacheRef.current.get(key)

    let cancelled = false
    setLoadingDay(true)
    setShowDaySkeleton(!known)

    if (cached !== undefined) {
      setDay(cached)
    } else if (!known) {
      setDay(null)
    }

    void fetchAdminScheduleDay(date, selectedRentalAssetIds)
      .then((daySchedule) => {
        if (cancelled) {
          return
        }
        setDay(daySchedule)
        loadedDayKeysRef.current.add(key)
        dayCacheRef.current.set(key, daySchedule)
      })
      .catch((error) => {
        if (!cancelled) {
          toast.error(
            error instanceof Error
              ? error.message
              : t("rentals.schedule.loadError"),
          )
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingDay(false)
          setShowDaySkeleton(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [selectedRentalAssetIds, date, t])

  useEffect(() => {
    if (!templateRentalAssetId) {
      return
    }
    let cancelled = false
    void listScheduleTemplates(templateRentalAssetId)
      .then((list) => {
        if (!cancelled) {
          setTemplates(list)
        }
      })
      .catch((error) => {
        if (!cancelled) {
          toast.error(
            error instanceof Error
              ? error.message
              : t("rentals.schedule.loadError"),
          )
        }
      })
    return () => {
      cancelled = true
    }
  }, [templateRentalAssetId, t])

  async function handleSaveKind(
    values: UpsertOccupancyKindInput,
  ): Promise<boolean> {
    if (!values.key.trim() || !values.label.trim()) {
      toast.error(t("rentals.schedule.kinds.validation"))
      return false
    }
    beginBusy("kind")
    try {
      if (editingKind) {
        await updateOccupancyKind(editingKind.id, values)
        toast.success(t("rentals.schedule.kinds.updateSuccess"))
      } else {
        await createOccupancyKind(values)
        toast.success(t("rentals.schedule.kinds.createSuccess"))
      }
      await loadKinds()
      return true
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("rentals.schedule.kinds.saveError"),
      )
      return false
    } finally {
      endBusy()
    }
  }

  async function handleSaveTemplate(draft: TemplateDraft): Promise<boolean> {
    if (!templateRentalAssetId || !draft.occupancyKindId) {
      toast.error(t("rentals.schedule.templates.validation"))
      return false
    }
    beginBusy("template")
    try {
      const body = {
        rentalAssetId: templateRentalAssetId,
        dayOfWeek: draft.dayOfWeek,
        startTime: draft.startTime,
        endTime: draft.endTime,
        occupancyKindId: draft.occupancyKindId,
        label: draft.label.trim() || null,
        isActive: draft.isActive,
      }
      if (editingTemplate) {
        await updateScheduleTemplate(editingTemplate.id, body)
        toast.success(t("rentals.schedule.templates.updateSuccess"))
      } else {
        await createScheduleTemplate(body)
        toast.success(t("rentals.schedule.templates.createSuccess"))
      }
      await Promise.all([refreshWeeklyTemplates(), refreshDay()])
      return true
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("rentals.schedule.templates.saveError"),
      )
      return false
    } finally {
      endBusy()
    }
  }

  async function onToggleTemplateActive(row: ScheduleTemplate) {
    beginBusy("templateToggle", row.id)
    try {
      await updateScheduleTemplate(row.id, {
        rentalAssetId: row.rentalAssetId,
        dayOfWeek: row.dayOfWeek,
        startTime: row.startTime,
        endTime: row.endTime,
        occupancyKindId: row.occupancyKindId,
        label: row.label,
        isActive: !row.isActive,
      })
      await Promise.all([refreshWeeklyTemplates(), refreshDay()])
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("rentals.schedule.templates.saveError"),
      )
    } finally {
      endBusy()
    }
  }

  async function onDeleteTemplate(id: string) {
    beginBusy("templateDelete", id)
    try {
      await deleteScheduleTemplate(id)
      toast.success(t("rentals.schedule.templates.deleteSuccess"))
      if (editingTemplate?.id === id) {
        setTemplateSheetOpen(false)
        setEditingTemplate(null)
      }
      await Promise.all([refreshWeeklyTemplates(), refreshDay()])
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("rentals.schedule.templates.deleteError"),
      )
    } finally {
      endBusy()
    }
  }

  async function onSeedSelected() {
    if (selectedRentalAssetIds.length === 0) {
      return
    }
    beginBusy("seed")
    try {
      const created = await seedDefaultHourlyTemplates(selectedRentalAssetIds)
      toast.success(t("rentals.schedule.seedSuccess", { count: created }))
      await Promise.all([refreshWeeklyTemplates(), refreshDay()])
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("rentals.schedule.seedError"),
      )
    } finally {
      endBusy()
    }
  }

  async function onSeedTemplateAsset() {
    if (!templateRentalAssetId) {
      return
    }
    beginBusy("seed")
    try {
      const created = await seedDefaultHourlyTemplates(templateRentalAssetId)
      toast.success(t("rentals.schedule.seedSuccess", { count: created }))
      await Promise.all([refreshWeeklyTemplates(), refreshDay()])
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("rentals.schedule.seedError"),
      )
    } finally {
      endBusy()
    }
  }

  async function onSavePolicy(input: UpdateSchedulePolicyInput) {
    if (selectedRentalAssetIds.length === 0) {
      return
    }
    beginBusy("policy")
    try {
      const updated = await updateRentalSchedulePolicyBulk(
        selectedRentalAssetIds,
        input,
      )
      setAssets((current) => mergeAssets(current, updated))
      toast.success(
        input.schedulePolicy === "OpenHours"
          ? t("rentals.schedule.policy.saveOpenHoursSuccess")
          : t("rentals.schedule.policy.saveSlotGridSuccess"),
      )
      await Promise.all([refreshWeeklyTemplates(), refreshDay()])
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("rentals.schedule.policy.saveError"),
      )
      throw error
    } finally {
      endBusy()
    }
  }

  async function onPublish() {
    if (selectedRentalAssetIds.length === 0 || !date) {
      return
    }
    beginBusy("publish")
    try {
      const created = await publishScheduleDay({
        date,
        rentalAssetIds: selectedRentalAssetIds,
      })
      toast.success(t("rentals.schedule.publishSuccess", { count: created }))
      await refreshDay()
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("rentals.schedule.publishError"),
      )
    } finally {
      endBusy()
    }
  }

  async function onApplyWeeklyRule(draft: WeeklyRuleDraft): Promise<boolean> {
    beginBusy("weeklyRule")
    try {
      const result = await applyWeeklyRule(draft)
      toast.success(
        t("rentals.schedule.weeklyRule.success", {
          count: result.created + result.updated,
        }),
      )
      await Promise.all([refreshWeeklyTemplates(), refreshDay()])
      return true
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("apiErrors.applyWeeklyRule"),
      )
      return false
    } finally {
      endBusy()
    }
  }

  function slotBusyKey(slot: AdminDaySlot): string {
    return `${slot.rentalAssetId}|${slot.startTime}|${slot.id}`
  }

  async function handleSlotAction(
    action: "Update" | "MakeUnavailable" | "RestoreWeeklyDefault",
    busyAction: Exclude<ScheduleBusyAction, null>,
    draft?: DaySlotDraft,
    scope: OccurrenceEditScope = "OnlyThisDay",
  ): Promise<boolean> {
    if (!editingCell) {
      return false
    }
    const slot = editingCell.slot
    beginBusy(busyAction, slot ? slotBusyKey(slot) : undefined)
    try {
      await applyDailyOccurrence({
        slotId: slot?.id ?? null,
        rentalAssetId: editingCell.rentalAssetId,
        date: editingCell.date,
        startTime: formatScheduleTime(editingCell.startTime),
        endTime: formatScheduleTime(editingCell.endTime),
        action,
        scope,
        occupancyKindId: draft?.occupancyKindId ?? slot?.occupancyKindId ?? defaultKindId,
        label: draft?.label ?? slot?.label ?? null,
      })
      toast.success(
        action === "Update"
          ? t("rentals.schedule.occurrence.updateSuccess")
          : action === "MakeUnavailable"
            ? t("rentals.schedule.occurrence.unavailableSuccess")
            : t("rentals.schedule.occurrence.restoreSuccess"),
      )
      await refreshDay()
      return true
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("rentals.schedule.occurrence.saveError"),
      )
      return false
    } finally {
      endBusy()
    }
  }

  const tabItems: { id: ScheduleTab; labelKey: string }[] = [
    { id: "daily", labelKey: "rentals.schedule.tabs.daily" },
    { id: "templates", labelKey: "rentals.schedule.tabs.templates" },
    { id: "kinds", labelKey: "rentals.schedule.tabs.kinds" },
  ]

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-6 p-4 sm:p-6">
      <div className="mx-auto w-full max-w-xl space-y-4 text-center">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("rentals.schedule.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("rentals.schedule.descriptionOperational")}
          </p>
        </div>

        <div className="border-b border-border">
          <nav
            className="-mb-px flex justify-center gap-6 overflow-x-auto sm:gap-8"
            aria-label={t("nav.menu")}
          >
            {tabItems.map((item) => {
              const isActive = tab === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setTab(item.id)
                  }}
                  className={cn(
                    "border-b-2 px-1 pb-3 text-sm font-medium whitespace-nowrap transition-colors",
                    isActive
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
                  )}
                >
                  {t(item.labelKey)}
                </button>
              )
            })}
          </nav>
        </div>
      </div>

      <div className="mt-8">
        {tab === "daily" ? (
          <DailyAgendaTab
            assets={assets}
            selectedRentalAssetIds={selectedRentalAssetIds}
            date={date}
            day={day}
            loading={loadingAssets || loadingDay}
            showSkeleton={
              !loadingAssets &&
              showDaySkeleton &&
              selectedRentalAssetIds.length > 0
            }
            busy={busy}
            busyAction={busyAction}
            busyTargetKey={busyTargetId}
            readOnly={isTrialReadOnly}
            onSelectedRentalAssetIdsChange={setSelectedRentalAssetIds}
            onDateChange={setDate}
            onPublish={() => {
              void onPublish()
            }}
            onGoWeeklySetup={() => setTab("templates")}
            onSlotOrCellClick={(target) => {
              setEditingCell(target)
              setSlotSheetOpen(true)
            }}
          />
        ) : null}

        {tab === "templates" ? (
          <WeeklyTemplatesTab
            assets={assets}
            selectedRentalAssetIds={selectedRentalAssetIds}
            rentalAssetId={templateRentalAssetId}
            templates={templates.filter(
              (row) => row.rentalAssetId === templateRentalAssetId,
            )}
            kinds={kinds}
            defaultKindId={defaultKindId}
            loading={loadingAssets}
            busy={busy}
            busyAction={busyAction}
            busyTargetId={busyTargetId}
            readOnly={isTrialReadOnly}
            onSelectedRentalAssetIdsChange={setSelectedRentalAssetIds}
            onRentalAssetChange={setTemplateRentalAssetId}
            onAdd={() => {
              setEditingTemplate(null)
              setTemplateSheetOpen(true)
            }}
            onEdit={(row) => {
              setEditingTemplate(row)
              setTemplateSheetOpen(true)
            }}
            onToggleActive={(row) => {
              void onToggleTemplateActive(row)
            }}
            onDelete={(id) => {
              void onDeleteTemplate(id)
            }}
            onSeedSelected={() => {
              void onSeedSelected()
            }}
            onSeedTemplates={() => {
              void onSeedTemplateAsset()
            }}
            onSavePolicy={onSavePolicy}
            onApplyWeeklyRule={onApplyWeeklyRule}
          />
        ) : null}

        {tab === "kinds" ? (
          <OccupancyKindsTab
            kinds={kinds}
            loading={loadingKinds}
            busy={busy}
            readOnly={isTrialReadOnly}
            onAdd={() => {
              setEditingKind(null)
              setKindSheetOpen(true)
            }}
            onEdit={(kind) => {
              setEditingKind(kind)
              setKindSheetOpen(true)
            }}
          />
        ) : null}
      </div>

      <OccupancyKindSheet
        open={kindSheetOpen}
        onOpenChange={(open) => {
          setKindSheetOpen(open)
          if (!open) {
            setEditingKind(null)
          }
        }}
        editing={editingKind}
        busy={busy}
        readOnly={isTrialReadOnly}
        onSubmit={handleSaveKind}
      />

      <TemplateSheet
        open={templateSheetOpen}
        onOpenChange={(open) => {
          setTemplateSheetOpen(open)
          if (!open) {
            setEditingTemplate(null)
          }
        }}
        editing={editingTemplate}
        kinds={kinds}
        defaultKindId={defaultKindId}
        busy={busy}
        busyAction={busyAction}
        readOnly={isTrialReadOnly}
        onSubmit={handleSaveTemplate}
      />

      <DaySlotSheet
        open={slotSheetOpen}
        onOpenChange={(open) => {
          setSlotSheetOpen(open)
          if (!open) {
            setEditingCell(null)
          }
        }}
        target={editingCell}
        kinds={kinds}
        defaultKindId={defaultKindId}
        busy={busy}
        busyAction={busyAction}
        readOnly={isTrialReadOnly}
        onSave={(draft, scope) =>
          handleSlotAction("Update", "slotUpdate", draft, scope)
        }
        onMakeUnavailable={(scope) =>
          handleSlotAction("MakeUnavailable", "slotUnavailable", undefined, scope)
        }
        onRestoreWeeklyDefault={() =>
          handleSlotAction("RestoreWeeklyDefault", "slotRestore")
        }
        onGoWeeklySetup={() => {
          setSlotSheetOpen(false)
          setTab("templates")
        }}
      />
    </div>
  )
}
