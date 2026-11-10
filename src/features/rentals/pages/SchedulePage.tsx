import { LeaveConfirmDialog } from "@/components/LeaveConfirmDialog"
import { PageHeader } from "@/components/layout/PageHeader"
import { StaffReturnLink } from "@/features/rentals/components/resourceWizard/StaffReturnLink"
import { safeStaffReturnTo } from "@/features/rentals/components/resourceWizard/staffReturnTo"
import {
  scheduleAssetIdFromSearch,
  scheduleTabFromSearch,
} from "@/features/rentals/components/resourceWizard/wizardSteps"
import { Card, CardContent } from "@/components/ui/card"
import { CalendarDays, CalendarRange, Tag } from "lucide-react"
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import {
  UNSAFE_DataRouterContext as DataRouterContext,
  useBlocker,
  useNavigate,
} from "react-router-dom"
import { formatTenantTimeZoneLabel } from "@/features/tenantPortal/lib/tenantTimeZoneLabel"
import { toast } from "sonner"

import { useTenantTimeZone } from "@/contexts/TenantTimeZoneContext"
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
import type { WeeklyGridCellPayload } from "@/features/rentals/components/schedule/WeeklyTemplatesTab"
import type { WeeklyRuleDraft } from "@/features/rentals/components/schedule/WeeklyRuleSheet"
import { occupancyIdFromSlot, todayWeekdayName } from "@/features/rentals/components/schedule/scheduleGridModel"
import {
  applyDailyOccurrence,
  applyWeeklyRule,
  createOccupancyKind,
  createScheduleTemplate,
  deleteScheduleTemplate,
  fetchAdminScheduleDay,
  formatScheduleTime,
  isPersistedSlotId,
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
  type DayOfWeekName,
  type UpdateSchedulePolicyInput,
  type UpsertOccupancyKindInput,
} from "@/features/rentals/services/scheduleService"
import { useTrialStatus } from "@/features/users/hooks/useTrialStatus"
import { cn } from "@/lib/utils"
import { usePermissions } from "@/features/users/permissions/PermissionContext"
import { TeacherLessonsPage } from "@/features/rentals/pages/TeacherLessonsPage"

type ScheduleTab = "daily" | "templates" | "kinds"

function ScheduleLeaveGuard({ dirty }: { dirty: boolean }) {
  const { t } = useTranslation()
  const blocker = useBlocker(dirty)
  return (
    <LeaveConfirmDialog
      open={blocker.state === "blocked"}
      title={t("fullPage.leaveConfirm")}
      onStay={() => {
        if (blocker.state === "blocked") blocker.reset()
      }}
      onLeave={() => {
        if (blocker.state === "blocked") blocker.proceed()
      }}
    />
  )
}

function dayCacheKey(rentalAssetIds: readonly string[], date: string): string {
  return `${[...rentalAssetIds].sort().join(",")}|${date}`
}

function templatesCacheKey(
  rentalAssetIds: readonly string[],
  weekday: string,
): string {
  return `${[...rentalAssetIds].sort().join(",")}|${weekday}`
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
  const { can } = usePermissions()
  const hasLessonOnlyAccess =
    can("rentals.schedule.lessons.write") && !can("rentals.schedule.write")

  return hasLessonOnlyAccess ? <TeacherLessonsPage /> : <AdminSchedulePage />
}

function AdminSchedulePage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { isTrialReadOnly } = useTrialStatus()
  const timeZoneId = useTenantTimeZone()

  const [tab, setTab] = useState<ScheduleTab>(
    () => scheduleTabFromSearch(window.location.search) ?? "daily",
  )
  const [assets, setAssets] = useState<AdminRentalAsset[]>([])
  const [selectedRentalAssetIds, setSelectedRentalAssetIds] = useState<string[]>(
    [],
  )
  const [weekday, setWeekday] = useState<DayOfWeekName>(todayWeekdayName)
  const [date, setDate] = useState(() => todayIsoDate(timeZoneId))
  const [kinds, setKinds] = useState<OccupancyKind[]>([])
  const [templates, setTemplates] = useState<ScheduleTemplate[]>([])
  const [scheduleTemplatesState, setScheduleTemplatesState] = useState<{
    key: string
    list: ScheduleTemplate[]
  } | null>(null)
  const [day, setDay] = useState<AdminDaySchedule | null>(null)
  const [loadingAssets, setLoadingAssets] = useState(true)
  const [loadingKinds, setLoadingKinds] = useState(true)
  const [kindsLoadError, setKindsLoadError] = useState(false)
  const [loadingDay, setLoadingDay] = useState(false)
  const [showDaySkeleton, setShowDaySkeleton] = useState(false)
  const [loadingTemplates, setLoadingTemplates] = useState(false)
  const [showTemplateSkeleton, setShowTemplateSkeleton] = useState(false)
  const [busy, setBusy] = useState(false)
  const [busyAction, setBusyAction] = useState<ScheduleBusyAction>(null)
  const [busyTargetId, setBusyTargetId] = useState<string | null>(null)

  const loadedDayKeysRef = useRef(new Set<string>())
  const dayCacheRef = useRef(new Map<string, AdminDaySchedule | null>())
  const loadedTemplateKeysRef = useRef(new Set<string>())
  const templatesCacheRef = useRef(new Map<string, ScheduleTemplate[]>())

  const [kindSheetOpen, setKindSheetOpen] = useState(false)
  const [editingKind, setEditingKind] = useState<OccupancyKind | null>(null)
  const [templateSheetOpen, setTemplateSheetOpen] = useState(false)
  const [templateDirty, setTemplateDirty] = useState(false)
  const [ruleOpen, setRuleOpen] = useState(false)
  const [ruleDirty, setRuleDirty] = useState(false)
  const [policyOpen, setPolicyOpen] = useState(false)
  const [policyDirty, setPolicyDirty] = useState(false)
  const [editingTemplate, setEditingTemplate] =
    useState<ScheduleTemplate | null>(null)
  const [weeklyTarget, setWeeklyTarget] =
    useState<WeeklyGridCellPayload | null>(null)
  const [slotSheetOpen, setSlotSheetOpen] = useState(false)
  const [pendingLeave, setPendingLeave] = useState<(() => void) | null>(null)
  const [editingCell, setEditingCell] =
    useState<DayResourceGridCellPayload | null>(null)
  const hasDataRouter = useContext(DataRouterContext) != null
  const draftDirty = (templateSheetOpen && templateDirty) || (ruleOpen && ruleDirty) || (policyOpen && policyDirty)

  useEffect(() => {
    if (!draftDirty) return
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => window.removeEventListener("beforeunload", handleBeforeUnload)
  }, [draftDirty])

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

  function clearTemplateDraft() {
    setTemplateSheetOpen(false)
    setTemplateDirty(false)
    setEditingTemplate(null)
    setWeeklyTarget(null)
  }

  function closeWeeklyRule() {
    setRuleOpen(false)
    setRuleDirty(false)
  }

  function closePolicy() {
    setPolicyOpen(false)
    setPolicyDirty(false)
  }

  function runOrAsk(action: () => void) {
    const proceed = () => {
      clearTemplateDraft()
      if (ruleDirty) closeWeeklyRule()
      if (policyDirty) closePolicy()
      action()
    }
    if (draftDirty) {
      setPendingLeave(() => proceed)
      return
    }
    proceed()
  }

  function requestCloseRule() {
    if (ruleOpen && ruleDirty) {
      setPendingLeave(() => closeWeeklyRule)
      return
    }
    setRuleOpen(false)
  }

  function requestClosePolicy() {
    if (policyOpen && policyDirty) {
      setPendingLeave(() => closePolicy)
      return
    }
    setPolicyOpen(false)
  }

  function discardTemplateDraft() {
    if (!draftDirty) {
      clearTemplateDraft()
      return true
    }
    if (hasDataRouter) return true
    const href = safeStaffReturnTo(new URLSearchParams(window.location.search).get("returnTo"))
    setPendingLeave(() => () => {
      clearTemplateDraft()
      closeWeeklyRule()
      closePolicy()
      if (href) navigate(href)
    })
    return false
  }

  function onSelectedRentalAssetIdsChange(ids: string[]) {
    if (ids.length === selectedRentalAssetIds.length &&
      ids.every((id) => selectedRentalAssetIds.includes(id))) return
    runOrAsk(() => setSelectedRentalAssetIds(ids))
  }

  const loadKinds = useCallback(async () => {
    setLoadingKinds(true)
    setKindsLoadError(false)
    try {
      const list = await listOccupancyKinds()
      setKinds(list)
    } catch (error) {
      setKindsLoadError(true)
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
          const requested = scheduleAssetIdFromSearch(window.location.search)
          if (requested && assetList.some((asset) => asset.id === requested)) {
            return [requested]
          }
          const valid = current.filter((id) =>
            assetList.some((asset) => asset.id === id),
          )
          return valid.length > 0 ? valid : assetList.map((asset) => asset.id)
        })
        if (assetList.length > 0) {
          setLoadingDay(true)
          setShowDaySkeleton(true)
        }
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

  const refreshAssets = useCallback(async () => {
    const assetList = await listAdminRentalAssets()
    setAssets(assetList)
  }, [])

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
    if (selectedRentalAssetIds.length === 0) {
      setTemplates([])
      return
    }
    const key = templatesCacheKey(selectedRentalAssetIds, weekday)
    const list = await listScheduleTemplates(
      undefined,
      selectedRentalAssetIds,
      weekday,
    )
    // Keep the visible day's cache available until its replacement is ready.
    // Asset reloads or tab navigation can rerun the templates effect meanwhile.
    loadedTemplateKeysRef.current.clear()
    templatesCacheRef.current.clear()
    setTemplates(list)
    loadedTemplateKeysRef.current.add(key)
    templatesCacheRef.current.set(key, list)
  }, [selectedRentalAssetIds, weekday])

  const refreshScheduleTemplates = useCallback(async () => {
    if (selectedRentalAssetIds.length === 0) return
    const list = await listScheduleTemplates(
      undefined,
      selectedRentalAssetIds,
      undefined,
    )
    setScheduleTemplatesState({
      key: selectedRentalAssetIds.join(","),
      list: list.filter((template) => template.isActive),
    })
  }, [selectedRentalAssetIds])

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
    if (selectedRentalAssetIds.length === 0) return
    let cancelled = false
    const key = selectedRentalAssetIds.join(",")
    void listScheduleTemplates(undefined, selectedRentalAssetIds, undefined)
      .then((list) => {
        if (!cancelled) {
          setScheduleTemplatesState({
            key,
            list: list.filter((template) => template.isActive),
          })
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
  }, [selectedRentalAssetIds, t])

  useEffect(() => {
    if (tab !== "templates" || selectedRentalAssetIds.length === 0) {
      if (selectedRentalAssetIds.length === 0) {
        setTemplates([])
      }
      setShowTemplateSkeleton(false)
      setLoadingTemplates(false)
      return
    }

    const key = templatesCacheKey(selectedRentalAssetIds, weekday)
    const known = loadedTemplateKeysRef.current.has(key)
    const cached = templatesCacheRef.current.get(key)

    let cancelled = false
    setLoadingTemplates(true)
    setShowTemplateSkeleton(!known)

    if (cached !== undefined) {
      setTemplates(cached)
    } else if (!known) {
      setTemplates([])
    }

    void listScheduleTemplates(undefined, selectedRentalAssetIds, weekday)
      .then((list) => {
        if (cancelled) {
          return
        }
        setTemplates(list)
        loadedTemplateKeysRef.current.add(key)
        templatesCacheRef.current.set(key, list)
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
          setLoadingTemplates(false)
          setShowTemplateSkeleton(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [selectedRentalAssetIds, t, tab, weekday])

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
    const rentalAssetId =
      editingTemplate?.rentalAssetId ?? weeklyTarget?.rentalAssetId
    if (!rentalAssetId || !draft.occupancyKindId) {
      toast.error(t("rentals.schedule.templates.validation"))
      return false
    }
    beginBusy("template", editingTemplate?.id)
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
      await Promise.all([
        refreshWeeklyTemplates(),
        refreshScheduleTemplates(),
        refreshDay(),
      ])
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

  async function onDeleteTemplate(id: string) {
    beginBusy("templateDelete", id)
    try {
      await deleteScheduleTemplate(id)
      toast.success(t("rentals.schedule.templates.deleteSuccess"))
      if (editingTemplate?.id === id) {
        setTemplateSheetOpen(false)
        setEditingTemplate(null)
        setWeeklyTarget(null)
      }
      await Promise.all([
        refreshWeeklyTemplates(),
        refreshScheduleTemplates(),
        refreshDay(),
      ])
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
      await Promise.all([
        refreshWeeklyTemplates(),
        refreshScheduleTemplates(),
        refreshDay(),
      ])
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
      await Promise.all([
        refreshWeeklyTemplates(),
        refreshScheduleTemplates(),
        refreshDay(),
      ])
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
      await Promise.all([
        refreshAssets(),
        refreshWeeklyTemplates(),
        refreshScheduleTemplates(),
        refreshDay(),
      ])
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
    return occupancyIdFromSlot(slot)
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
        slotId: slot && isPersistedSlotId(slot.id) ? slot.id : null,
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

  const tabItems: {
    id: ScheduleTab
    labelKey: string
    shortLabelKey: string
    icon: typeof CalendarDays
  }[] = [
    { id: "daily", labelKey: "rentals.schedule.tabs.daily", shortLabelKey: "rentals.schedule.tabs.dailyShort", icon: CalendarDays },
    { id: "templates", labelKey: "rentals.schedule.tabs.templates", shortLabelKey: "rentals.schedule.tabs.templatesShort", icon: CalendarRange },
    { id: "kinds", labelKey: "rentals.schedule.tabs.kinds", shortLabelKey: "rentals.schedule.tabs.kindsShort", icon: Tag },
  ]

  const scheduleTemplatesKey = selectedRentalAssetIds.join(",")
  const loadingScheduleTemplates = selectedRentalAssetIds.length > 0 &&
    scheduleTemplatesState?.key !== scheduleTemplatesKey
  const scheduleTemplates = loadingScheduleTemplates || !scheduleTemplatesState
    ? []
    : scheduleTemplatesState.list

  return (
    <div className="mx-auto w-full min-w-0 max-w-7xl space-y-6">
      <div className="min-w-0 space-y-4">
        <StaffReturnLink beforeNavigate={discardTemplateDraft} />
        <div className="space-y-1">
          <PageHeader
            icon={CalendarDays}
            title={t("rentals.schedule.title")}
            description={t("rentals.schedule.descriptionOperational")}
            className="mb-0 sm:mb-0"
          />
          <p className="text-xs text-muted-foreground" data-testid="tenant-tz-label">
            {formatTenantTimeZoneLabel(timeZoneId, i18n.language, date)}
          </p>
        </div>

        <div
          role="group"
          aria-label={t("nav.menu")}
          className="grid h-auto w-full grid-cols-3 gap-1 rounded-lg bg-muted p-1 text-muted-foreground sm:flex sm:w-max"
        >
          {tabItems.map((item) => {
            const isActive = tab === item.id
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={isActive}
                onClick={() => {
                  if (item.id === tab) return
                  runOrAsk(() => {
                    if (item.id !== "templates") {
                      closeWeeklyRule()
                      closePolicy()
                    }
                    setTab(item.id)
                  })
                }}
                className={cn(
                  "touch-target inline-flex min-h-9 min-w-0 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium motion-safe:transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-3",
                  isActive ? "bg-background text-foreground shadow-sm" : "hover:text-foreground",
                )}
              >
                <item.icon aria-hidden className="size-4 shrink-0" />
                <span className="truncate sm:hidden">{t(item.shortLabelKey)}</span>
                <span className="hidden sm:inline">{t(item.labelKey)}</span>
              </button>
            )
          })}
        </div>
      </div>

      <Card className="min-w-0 motion-reduce:transition-none">
      <CardContent className="min-w-0 px-3 sm:px-5">
        {tab === "daily" ? (
          <DailyAgendaTab
            assets={assets}
            selectedRentalAssetIds={selectedRentalAssetIds}
            date={date}
            day={day}
            loading={loadingAssets || loadingDay}
            showSkeleton={
              loadingAssets ||
              (showDaySkeleton && selectedRentalAssetIds.length > 0)
            }
            busy={busy}
            busyAction={busyAction}
            busyTargetKey={busyTargetId}
            readOnly={isTrialReadOnly}
            onSelectedRentalAssetIdsChange={onSelectedRentalAssetIdsChange}
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
            weekday={weekday}
            templates={templates}
            scheduleTemplates={scheduleTemplates}
            loadingScheduleTemplates={loadingScheduleTemplates}
            kinds={kinds}
            defaultKindId={defaultKindId}
            loading={loadingAssets || loadingTemplates}
            showSkeleton={
              loadingAssets ||
              (showTemplateSkeleton && selectedRentalAssetIds.length > 0)
            }
            busy={busy}
            busyAction={busyAction}
            busyTargetId={busyTargetId}
            readOnly={isTrialReadOnly}
            onSelectedRentalAssetIdsChange={onSelectedRentalAssetIdsChange}
            onWeekdayChange={(nextWeekday) => {
              if (nextWeekday === weekday) return
              runOrAsk(() => setWeekday(nextWeekday))
            }}
            onCellClick={(target) => {
              if (templateSheetOpen && weeklyTarget?.rentalAssetId === target.rentalAssetId &&
                weeklyTarget.dayOfWeek === target.dayOfWeek && weeklyTarget.startTime === target.startTime) return
              runOrAsk(() => {
                setWeeklyTarget(target)
                setEditingTemplate(target.template)
                setTemplateSheetOpen(true)
              })
            }}
            onSeedSelected={() => {
              void onSeedSelected()
            }}
            onSavePolicy={onSavePolicy}
            templateEditor={<>
              {templateSheetOpen && kindsLoadError ? (
                <p role="alert" className="text-sm text-destructive">
                  {t("rentals.schedule.kindsLoadError")}
                </p>
              ) : null}
              <TemplateSheet
                key={`${weeklyTarget?.rentalAssetId}:${weeklyTarget?.dayOfWeek}:${weeklyTarget?.startTime}`}
                open={templateSheetOpen}
                onOpenChange={(open) => {
                  setTemplateSheetOpen(open)
                  if (!open) {
                    setEditingTemplate(null)
                    setWeeklyTarget(null)
                  }
                }}
                onDirtyChange={setTemplateDirty}
                editing={editingTemplate}
                assetName={weeklyTarget?.assetName}
                lockDayOfWeek={Boolean(weeklyTarget)}
                defaults={
                  weeklyTarget && !editingTemplate
                    ? {
                        dayOfWeek: weeklyTarget.dayOfWeek,
                        startTime: formatScheduleTime(weeklyTarget.startTime),
                        endTime: formatScheduleTime(weeklyTarget.endTime),
                      }
                    : undefined
                }
                kinds={kinds}
                defaultKindId={defaultKindId}
                busy={busy}
                busyAction={busyAction}
                readOnly={isTrialReadOnly}
                onSubmit={handleSaveTemplate}
                onDelete={
                  editingTemplate
                    ? () => {
                        void onDeleteTemplate(editingTemplate.id)
                      }
                    : undefined
                }
              />
            </>}
            onApplyWeeklyRule={onApplyWeeklyRule}
            ruleOpen={ruleOpen}
            onRuleOpenChange={setRuleOpen}
            onRuleDirtyChange={setRuleDirty}
            onRuleRequestClose={requestCloseRule}
            policyOpen={policyOpen}
            onPolicyOpenChange={setPolicyOpen}
            onPolicyDirtyChange={setPolicyDirty}
            onPolicyRequestClose={requestClosePolicy}
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
      </CardContent>
      </Card>

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


      {hasDataRouter ? <ScheduleLeaveGuard dirty={draftDirty} /> : null}
      <LeaveConfirmDialog
        open={pendingLeave != null}
        title={t("fullPage.leaveConfirm")}
        onStay={() => setPendingLeave(null)}
        onLeave={() => {
          const action = pendingLeave
          setPendingLeave(null)
          action?.()
        }}
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
