import { useCallback, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DailyAgendaTab } from "@/features/rentals/components/schedule/DailyAgendaTab"
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
  updateScheduleTemplate,
  type AdminDaySchedule,
  type AdminRentalAsset,
  type OccupancyKind,
  type ScheduleTemplate,
  type UpsertOccupancyKindInput,
} from "@/features/rentals/services/scheduleService"
import { useTrialStatus } from "@/features/users/hooks/useTrialStatus"

type ScheduleTab = "daily" | "templates" | "kinds"

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
  const [busy, setBusy] = useState(false)

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
    const [templateList, daySchedule] = await Promise.all([
      listScheduleTemplates(rentalAssetId),
      fetchAdminScheduleDay(date, rentalAssetId),
    ])
    setTemplates(templateList)
    setDay(daySchedule)
  }, [date, rentalAssetId])

  useEffect(() => {
    if (!rentalAssetId || !date) {
      setTemplates([])
      setDay(null)
      return
    }

    let cancelled = false
    setLoadingDay(true)
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
    setBusy(true)
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
      setBusy(false)
    }
  }

  async function handleSaveTemplate(draft: TemplateDraft): Promise<boolean> {
    if (!rentalAssetId || !draft.occupancyKindId) {
      toast.error(t("rentals.schedule.templates.validation"))
      return false
    }
    setBusy(true)
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
      setBusy(false)
    }
  }

  async function onToggleTemplateActive(row: ScheduleTemplate) {
    setBusy(true)
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
      setBusy(false)
    }
  }

  async function onDeleteTemplate(id: string) {
    setBusy(true)
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
      setBusy(false)
    }
  }

  async function onSeedTemplates() {
    if (!rentalAssetId) {
      return
    }
    setBusy(true)
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
      setBusy(false)
    }
  }

  async function onPublish() {
    if (!rentalAssetId || !date) {
      return
    }
    setBusy(true)
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
      setBusy(false)
    }
  }

  const loading = loadingAssets || loadingDay

  return (
    <div className="mx-auto w-full max-w-4xl space-y-8 p-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("rentals.schedule.title")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("rentals.schedule.description")}
        </p>
      </div>

      <Tabs
        value={tab}
        onValueChange={(value) => {
          if (value === "daily" || value === "templates" || value === "kinds") {
            setTab(value)
          }
        }}
      >
        <TabsList className="w-full max-w-xl sm:w-auto">
          <TabsTrigger value="daily">
            {t("rentals.schedule.tabs.daily")}
          </TabsTrigger>
          <TabsTrigger value="templates">
            {t("rentals.schedule.tabs.templates")}
          </TabsTrigger>
          <TabsTrigger value="kinds">
            {t("rentals.schedule.tabs.kinds")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="daily" className="mt-6">
          <DailyAgendaTab
            assets={assets}
            rentalAssetId={rentalAssetId}
            date={date}
            day={day}
            loading={loading}
            busy={busy}
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
          />
        </TabsContent>

        <TabsContent value="templates" className="mt-6">
          <WeeklyTemplatesTab
            assets={assets}
            rentalAssetId={rentalAssetId}
            templates={templates}
            loading={loading}
            busy={busy}
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
        </TabsContent>

        <TabsContent value="kinds" className="mt-6">
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
        </TabsContent>
      </Tabs>

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
        readOnly={isTrialReadOnly}
        onSubmit={handleSaveTemplate}
      />
    </div>
  )
}
