import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import {
  DailyAgendaTab,
  type ScheduleBusyAction,
} from "@/features/rentals/components/schedule/DailyAgendaTab"
import { OccupancyKindSheet } from "@/features/rentals/components/schedule/OccupancyKindSheet"
import { OccupancyKindsTab } from "@/features/rentals/components/schedule/OccupancyKindsTab"
import { todayIsoDate } from "@/features/rentals/components/schedule/scheduleFormDefaults"
import type { TemplateDraft } from "@/features/rentals/components/schedule/scheduleFormDefaults"
import { TemplateSheet } from "@/features/rentals/components/schedule/TemplateSheet"
import { WeeklyTemplatesTab } from "@/features/rentals/components/schedule/WeeklyTemplatesTab"
import {
  createOccupancyKind,
  createScheduleTemplate,
  deleteScheduleTemplate,
  fetchAdminScheduleDay,
  listAdminRentalAssets,
  listOccupancyKinds,
  listScheduleTemplates,
  publishScheduleDay,
  seedDefaultHourlyTemplates,
  updateOccupancyKind,
  updateRentalSchedulePolicy,
  updateScheduleTemplate,
  type AdminDaySchedule,
  type AdminRentalAsset,
  type OccupancyKind,
  type ScheduleTemplate,
  type UpdateSchedulePolicyInput,
  type UpsertOccupancyKindInput,
} from "@/features/rentals/services/scheduleService"
import { useTrialStatus } from "@/features/users/hooks/useTrialStatus"
import { cn } from "@/lib/utils"

type ScheduleTab = "daily" | "templates" | "kinds"

function dayCacheKey(rentalAssetId: string, date: string): string {
  return `${rentalAssetId}|${date}`
}

export function SchedulePage() {
  const { t } = useTranslation()
  const { isTrialReadOnly } = useTrialStatus()

  const [tab, setTab] = useState<ScheduleTab>("daily")
  const [assets, setAssets] = useState<AdminRentalAsset[]>([])
  const [rentalAssetId, setRentalAssetId] = useState("")
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
        setRentalAssetId((current) =>
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
    if (!rentalAssetId || !date) {
      return
    }
    const key = dayCacheKey(rentalAssetId, date)
    const [templateList, daySchedule] = await Promise.all([
      listScheduleTemplates(rentalAssetId),
      fetchAdminScheduleDay(date, rentalAssetId),
    ])
    setTemplates(templateList)
    setDay(daySchedule)
    loadedDayKeysRef.current.add(key)
    dayCacheRef.current.set(key, daySchedule)
  }, [date, rentalAssetId])

  useEffect(() => {
    if (!rentalAssetId || !date) {
      setTemplates([])
      setDay(null)
      setShowDaySkeleton(false)
      setLoadingDay(false)
      return
    }

    const key = dayCacheKey(rentalAssetId, date)
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

    void Promise.all([
      listScheduleTemplates(rentalAssetId),
      fetchAdminScheduleDay(date, rentalAssetId),
    ])
      .then(([templateList, daySchedule]) => {
        if (cancelled) {
          return
        }
        setTemplates(templateList)
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
  }, [rentalAssetId, date, t])

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
    if (!rentalAssetId || !draft.occupancyKindId) {
      toast.error(t("rentals.schedule.templates.validation"))
      return false
    }
    beginBusy("template")
    try {
      const body = {
        rentalAssetId,
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
      await refreshDay()
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
      await refreshDay()
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
      await refreshDay()
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

  async function onSeedTemplates() {
    if (!rentalAssetId) {
      return
    }
    beginBusy("seed")
    try {
      const created = await seedDefaultHourlyTemplates(rentalAssetId)
      toast.success(t("rentals.schedule.seedSuccess", { count: created }))
      await refreshDay()
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
    if (!rentalAssetId) {
      return
    }
    beginBusy("policy")
    try {
      const updated = await updateRentalSchedulePolicy(rentalAssetId, input)
      setAssets((current) =>
        current.map((asset) => (asset.id === updated.id ? updated : asset)),
      )
      toast.success(
        input.schedulePolicy === "OpenHours"
          ? t("rentals.schedule.policy.saveOpenHoursSuccess")
          : t("rentals.schedule.policy.saveSlotGridSuccess"),
      )
      await refreshDay()
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
    if (!rentalAssetId || !date) {
      return
    }
    beginBusy("publish")
    try {
      const created = await publishScheduleDay({
        date,
        rentalAssetId,
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

  const tabItems: { id: ScheduleTab; labelKey: string }[] = [
    { id: "daily", labelKey: "rentals.schedule.tabs.daily" },
    { id: "templates", labelKey: "rentals.schedule.tabs.templates" },
    { id: "kinds", labelKey: "rentals.schedule.tabs.kinds" },
  ]

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 p-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("rentals.schedule.title")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("rentals.schedule.description")}
        </p>
      </div>

      <div className="border-b border-border">
        <nav className="-mb-px flex space-x-8" aria-label={t("nav.menu")}>
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

      <div className="mt-8">
        {tab === "daily" ? (
          <DailyAgendaTab
            assets={assets}
            rentalAssetId={rentalAssetId}
            date={date}
            day={day}
            loading={loadingAssets || loadingDay}
            showSkeleton={
              !loadingAssets && showDaySkeleton && Boolean(rentalAssetId)
            }
            busy={busy}
            busyAction={busyAction}
            readOnly={isTrialReadOnly}
            hasTemplates={templates.length > 0}
            onRentalAssetChange={setRentalAssetId}
            onDateChange={setDate}
            onPublish={() => {
              void onPublish()
            }}
            onSeedTemplates={() => {
              void onSeedTemplates()
            }}
            onSavePolicy={onSavePolicy}
          />
        ) : null}

        {tab === "templates" ? (
          <WeeklyTemplatesTab
            assets={assets}
            rentalAssetId={rentalAssetId}
            templates={templates}
            loading={loadingAssets || loadingDay}
            busy={busy}
            busyAction={busyAction}
            busyTargetId={busyTargetId}
            readOnly={isTrialReadOnly}
            onRentalAssetChange={setRentalAssetId}
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
            onSeedTemplates={() => {
              void onSeedTemplates()
            }}
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
    </div>
  )
}
