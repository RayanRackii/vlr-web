import { useCallback, useEffect, useMemo, useState } from "react"
import { CircleHelp } from "lucide-react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  createOccupancyKind,
  createScheduleTemplate,
  DAY_NAMES,
  deleteScheduleTemplate,
  fetchAdminScheduleDay,
  formatScheduleTime,
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

function todayIsoDate(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `${now.getFullYear()}-${month}-${day}`
}

function emptyKindForm(): UpsertOccupancyKindInput {
  return {
    key: "",
    label: "",
    colorHex: "#22c55e",
    isBookableByCustomer: true,
    blocksCapacity: true,
    sortOrder: 100,
    isActive: true,
  }
}

type TemplateDraft = {
  dayOfWeek: string
  startTime: string
  endTime: string
  occupancyKindId: string
  label: string
  isActive: boolean
}

function emptyTemplateDraft(kindId: string): TemplateDraft {
  return {
    dayOfWeek: "Monday",
    startTime: "08:00",
    endTime: "09:00",
    occupancyKindId: kindId,
    label: "",
    isActive: true,
  }
}

function FieldHelp({ text }: { text: string }) {
  return (
    <Popover>
      <PopoverTrigger
        type="button"
        className="inline-flex size-4 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={text}
      >
        <CircleHelp className="size-3.5" aria-hidden />
      </PopoverTrigger>
      <PopoverContent align="start" side="top" className="w-64 p-3 text-xs leading-relaxed">
        <PopoverDescription className="text-xs text-muted-foreground">
          {text}
        </PopoverDescription>
      </PopoverContent>
    </Popover>
  )
}

function FieldLabel({
  label,
  help,
}: {
  label: string
  help: string
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {label}
      <FieldHelp text={help} />
    </span>
  )
}

export function SchedulePage() {
  const { t } = useTranslation()
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

  const [kindForm, setKindForm] = useState<UpsertOccupancyKindInput>(emptyKindForm)
  const [editingKindId, setEditingKindId] = useState<string | null>(null)

  const [templateDraft, setTemplateDraft] = useState<TemplateDraft>(
    emptyTemplateDraft(""),
  )
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null)

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
    if (!templateDraft.occupancyKindId && defaultKindId) {
      setTemplateDraft((current) => ({
        ...current,
        occupancyKindId: defaultKindId,
      }))
    }
  }, [defaultKindId, templateDraft.occupancyKindId])

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

  function startEditKind(kind: OccupancyKind) {
    setEditingKindId(kind.id)
    setKindForm({
      key: kind.key,
      label: kind.label,
      colorHex: kind.colorHex ?? "",
      isBookableByCustomer: kind.isBookableByCustomer,
      blocksCapacity: kind.blocksCapacity,
      sortOrder: kind.sortOrder,
      isActive: kind.isActive,
    })
  }

  function resetKindForm() {
    setEditingKindId(null)
    setKindForm(emptyKindForm())
  }

  async function onSaveKind() {
    if (!kindForm.key.trim() || !kindForm.label.trim()) {
      toast.error(t("rentals.schedule.kinds.validation"))
      return
    }
    setBusy(true)
    try {
      if (editingKindId) {
        await updateOccupancyKind(editingKindId, kindForm)
        toast.success(t("rentals.schedule.kinds.updateSuccess"))
      } else {
        await createOccupancyKind(kindForm)
        toast.success(t("rentals.schedule.kinds.createSuccess"))
      }
      resetKindForm()
      await loadKinds()
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("rentals.schedule.kinds.saveError"),
      )
    } finally {
      setBusy(false)
    }
  }

  function startEditTemplate(row: ScheduleTemplate) {
    setEditingTemplateId(row.id)
    setTemplateDraft({
      dayOfWeek: row.dayOfWeek,
      startTime: formatScheduleTime(row.startTime),
      endTime: formatScheduleTime(row.endTime),
      occupancyKindId: row.occupancyKindId,
      label: row.label ?? "",
      isActive: row.isActive,
    })
  }

  function resetTemplateDraft() {
    setEditingTemplateId(null)
    setTemplateDraft(emptyTemplateDraft(defaultKindId))
  }

  async function onSaveTemplate() {
    if (!rentalAssetId || !templateDraft.occupancyKindId) {
      toast.error(t("rentals.schedule.templates.validation"))
      return
    }
    setBusy(true)
    try {
      const body = {
        rentalAssetId,
        dayOfWeek: templateDraft.dayOfWeek,
        startTime: templateDraft.startTime,
        endTime: templateDraft.endTime,
        occupancyKindId: templateDraft.occupancyKindId,
        label: templateDraft.label.trim() || null,
        isActive: templateDraft.isActive,
      }
      if (editingTemplateId) {
        await updateScheduleTemplate(editingTemplateId, body)
        toast.success(t("rentals.schedule.templates.updateSuccess"))
      } else {
        await createScheduleTemplate(body)
        toast.success(t("rentals.schedule.templates.createSuccess"))
      }
      resetTemplateDraft()
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
      if (editingTemplateId === id) {
        resetTemplateDraft()
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

  const templatesByDay = useMemo(() => {
    const map = new Map<string, ScheduleTemplate[]>()
    for (const dayName of DAY_NAMES) {
      map.set(dayName, [])
    }
    for (const row of templates) {
      const list = map.get(row.dayOfWeek) ?? []
      list.push(row)
      map.set(row.dayOfWeek, list)
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.startTime.localeCompare(b.startTime))
    }
    return map
  }, [templates])

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

      <section className="space-y-3">
        <h2 className="text-sm font-medium">
          {t("rentals.schedule.kinds.title")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("rentals.schedule.kinds.description")}
        </p>

        {loadingKinds ? (
          <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border">
            {kinds.length === 0 ? (
              <li className="px-3 py-2 text-sm text-muted-foreground">
                {t("rentals.schedule.kinds.empty")}
              </li>
            ) : (
              kinds.map((kind) => (
                <li
                  key={kind.id}
                  className="flex flex-col gap-2 px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="font-medium">
                      {kind.label}
                      <span className="ml-2 text-xs text-muted-foreground">
                        {kind.key}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {kind.isBookableByCustomer
                        ? t("rentals.schedule.kinds.bookable")
                        : t("rentals.schedule.kinds.notBookable")}
                      {" · "}
                      {kind.isActive
                        ? t("rentals.schedule.active")
                        : t("rentals.schedule.inactive")}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => {
                      startEditKind(kind)
                    }}
                  >
                    {t("common.edit")}
                  </Button>
                </li>
              ))
            )}
          </ul>
        )}

        <div className="grid gap-3 rounded-md border border-border p-3 sm:grid-cols-2">
          <label className="space-y-1 text-sm">
            <FieldLabel
              label={t("rentals.schedule.kinds.key")}
              help={t("rentals.schedule.kinds.help.key")}
            />
            <Input
              value={kindForm.key}
              disabled={Boolean(editingKindId)}
              placeholder={t("rentals.schedule.kinds.placeholders.key")}
              onChange={(event) => {
                setKindForm((current) => ({
                  ...current,
                  key: event.target.value,
                }))
              }}
            />
          </label>
          <label className="space-y-1 text-sm">
            <FieldLabel
              label={t("rentals.schedule.kinds.label")}
              help={t("rentals.schedule.kinds.help.label")}
            />
            <Input
              value={kindForm.label}
              placeholder={t("rentals.schedule.kinds.placeholders.label")}
              onChange={(event) => {
                setKindForm((current) => ({
                  ...current,
                  label: event.target.value,
                }))
              }}
            />
          </label>
          <label className="space-y-1 text-sm">
            <FieldLabel
              label={t("rentals.schedule.kinds.color")}
              help={t("rentals.schedule.kinds.help.color")}
            />
            <Input
              type="color"
              value={kindForm.colorHex || "#22c55e"}
              onChange={(event) => {
                setKindForm((current) => ({
                  ...current,
                  colorHex: event.target.value,
                }))
              }}
            />
          </label>
          <label className="space-y-1 text-sm">
            <FieldLabel
              label={t("rentals.schedule.kinds.sortOrder")}
              help={t("rentals.schedule.kinds.help.sortOrder")}
            />
            <Input
              type="number"
              value={kindForm.sortOrder}
              onChange={(event) => {
                setKindForm((current) => ({
                  ...current,
                  sortOrder: Number(event.target.value) || 0,
                }))
              }}
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={kindForm.isBookableByCustomer}
              onChange={(event) => {
                setKindForm((current) => ({
                  ...current,
                  isBookableByCustomer: event.target.checked,
                }))
              }}
            />
            <FieldLabel
              label={t("rentals.schedule.kinds.bookable")}
              help={t("rentals.schedule.kinds.help.bookable")}
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={kindForm.blocksCapacity}
              onChange={(event) => {
                setKindForm((current) => ({
                  ...current,
                  blocksCapacity: event.target.checked,
                }))
              }}
            />
            <FieldLabel
              label={t("rentals.schedule.kinds.blocksCapacity")}
              help={t("rentals.schedule.kinds.help.blocksCapacity")}
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={kindForm.isActive}
              onChange={(event) => {
                setKindForm((current) => ({
                  ...current,
                  isActive: event.target.checked,
                }))
              }}
            />
            <FieldLabel
              label={t("rentals.schedule.active")}
              help={t("rentals.schedule.kinds.help.active")}
            />
          </label>
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <Button
              type="button"
              size="sm"
              disabled={busy}
              onClick={() => {
                void onSaveKind()
              }}
            >
              {editingKindId
                ? t("rentals.schedule.kinds.saveEdit")
                : t("rentals.schedule.kinds.saveCreate")}
            </Button>
            {editingKindId ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={resetKindForm}
              >
                {t("common.cancel")}
              </Button>
            ) : null}
          </div>
        </div>
      </section>

      {loadingAssets ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : assets.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t("rentals.schedule.noAssets")}
        </p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span>{t("rentals.schedule.rentable")}</span>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                value={rentalAssetId}
                onChange={(event) => {
                  setRentalAssetId(event.target.value)
                  resetTemplateDraft()
                }}
              >
                {assets.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.name}
                    {asset.schedulePolicy
                      ? ` (${asset.schedulePolicy})`
                      : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span>{t("rentals.schedule.date")}</span>
              <Input
                type="date"
                value={date}
                onChange={(event) => {
                  setDate(event.target.value)
                }}
              />
            </label>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              disabled={busy || !rentalAssetId}
              onClick={() => {
                void onSeedTemplates()
              }}
            >
              {t("rentals.schedule.seedTemplates")}
            </Button>
            <Button
              type="button"
              disabled={busy || !rentalAssetId}
              onClick={() => {
                void onPublish()
              }}
            >
              {t("rentals.schedule.publishDay")}
            </Button>
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
          ) : (
            <>
              <section className="space-y-3">
                <h2 className="text-sm font-medium">
                  {t("rentals.schedule.templatesTitle", {
                    count: templates.length,
                  })}
                </h2>

                <div className="grid gap-3 rounded-md border border-border p-3 sm:grid-cols-2">
                  <label className="space-y-1 text-sm">
                    <span>{t("rentals.schedule.templates.dayOfWeek")}</span>
                    <select
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                      value={templateDraft.dayOfWeek}
                      onChange={(event) => {
                        setTemplateDraft((current) => ({
                          ...current,
                          dayOfWeek: event.target.value,
                        }))
                      }}
                    >
                      {DAY_NAMES.map((dayName) => (
                        <option key={dayName} value={dayName}>
                          {t(`rentals.schedule.days.${dayName}`)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1 text-sm">
                    <span>{t("rentals.schedule.templates.kind")}</span>
                    <select
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                      value={templateDraft.occupancyKindId}
                      onChange={(event) => {
                        setTemplateDraft((current) => ({
                          ...current,
                          occupancyKindId: event.target.value,
                        }))
                      }}
                    >
                      {kinds
                        .filter((kind) => kind.isActive || kind.id === templateDraft.occupancyKindId)
                        .map((kind) => (
                          <option key={kind.id} value={kind.id}>
                            {kind.label}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label className="space-y-1 text-sm">
                    <span>{t("rentals.schedule.templates.start")}</span>
                    <Input
                      type="time"
                      value={templateDraft.startTime}
                      onChange={(event) => {
                        setTemplateDraft((current) => ({
                          ...current,
                          startTime: event.target.value,
                        }))
                      }}
                    />
                  </label>
                  <label className="space-y-1 text-sm">
                    <span>{t("rentals.schedule.templates.end")}</span>
                    <Input
                      type="time"
                      value={templateDraft.endTime}
                      onChange={(event) => {
                        setTemplateDraft((current) => ({
                          ...current,
                          endTime: event.target.value,
                        }))
                      }}
                    />
                  </label>
                  <label className="space-y-1 text-sm sm:col-span-2">
                    <span>{t("rentals.schedule.templates.label")}</span>
                    <Input
                      value={templateDraft.label}
                      onChange={(event) => {
                        setTemplateDraft((current) => ({
                          ...current,
                          label: event.target.value,
                        }))
                      }}
                    />
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={templateDraft.isActive}
                      onChange={(event) => {
                        setTemplateDraft((current) => ({
                          ...current,
                          isActive: event.target.checked,
                        }))
                      }}
                    />
                    {t("rentals.schedule.active")}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      disabled={busy || !rentalAssetId}
                      onClick={() => {
                        void onSaveTemplate()
                      }}
                    >
                      {editingTemplateId
                        ? t("rentals.schedule.templates.saveEdit")
                        : t("rentals.schedule.templates.saveCreate")}
                    </Button>
                    {editingTemplateId ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={resetTemplateDraft}
                      >
                        {t("common.cancel")}
                      </Button>
                    ) : null}
                  </div>
                </div>

                {templates.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {t("rentals.schedule.templatesEmpty")}
                  </p>
                ) : (
                  <div className="space-y-4">
                    {DAY_NAMES.map((dayName) => {
                      const rows = templatesByDay.get(dayName) ?? []
                      if (rows.length === 0) {
                        return null
                      }
                      return (
                        <div key={dayName} className="space-y-2">
                          <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            {t(`rentals.schedule.days.${dayName}`)}
                          </h3>
                          <ul className="divide-y divide-border rounded-md border border-border">
                            {rows.map((row) => (
                              <li
                                key={row.id}
                                className="flex flex-col gap-2 px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"
                              >
                                <div>
                                  <p>
                                    {formatScheduleTime(row.startTime)} –{" "}
                                    {formatScheduleTime(row.endTime)}
                                    <span className="ml-2 text-muted-foreground">
                                      {row.occupancyKindLabel}
                                    </span>
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {row.isActive
                                      ? t("rentals.schedule.active")
                                      : t("rentals.schedule.inactive")}
                                    {row.label ? ` · ${row.label}` : ""}
                                  </p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    disabled={busy}
                                    onClick={() => {
                                      startEditTemplate(row)
                                    }}
                                  >
                                    {t("common.edit")}
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    disabled={busy}
                                    onClick={() => {
                                      void onToggleTemplateActive(row)
                                    }}
                                  >
                                    {row.isActive
                                      ? t("rentals.schedule.deactivate")
                                      : t("rentals.schedule.activate")}
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    disabled={busy}
                                    onClick={() => {
                                      void onDeleteTemplate(row.id)
                                    }}
                                  >
                                    {t("common.delete")}
                                  </Button>
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )
                    })}
                  </div>
                )}
              </section>

              <section className="space-y-2">
                <h2 className="text-sm font-medium">
                  {t("rentals.schedule.dayTitle")}
                </h2>
                {!day || day.slots.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {t("rentals.schedule.dayEmpty")}
                  </p>
                ) : (
                  <ul className="divide-y divide-border rounded-md border border-border">
                    {day.slots.map((slot) => (
                      <li
                        key={`${slot.id}-${slot.startTime}-${slot.status}`}
                        className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                      >
                        <span>
                          {formatScheduleTime(slot.startTime)} –{" "}
                          {formatScheduleTime(slot.endTime)}
                          <span className="ml-2 text-muted-foreground">
                            {slot.occupancyKindLabel}
                          </span>
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {slot.status}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}
        </>
      )}
    </div>
  )
}
