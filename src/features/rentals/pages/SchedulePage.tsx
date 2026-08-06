import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  fetchAdminScheduleDay,
  formatScheduleTime,
  listAdminRentalAssets,
  listScheduleTemplates,
  publishScheduleDay,
  seedDefaultHourlyTemplates,
  type AdminDaySchedule,
  type AdminRentalAsset,
  type ScheduleTemplate,
} from "@/features/rentals/services/scheduleService"

function todayIsoDate(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `${now.getFullYear()}-${month}-${day}`
}

export function SchedulePage() {
  const { t } = useTranslation()
  const [assets, setAssets] = useState<AdminRentalAsset[]>([])
  const [rentalAssetId, setRentalAssetId] = useState("")
  const [date, setDate] = useState(todayIsoDate())
  const [templates, setTemplates] = useState<ScheduleTemplate[]>([])
  const [day, setDay] = useState<AdminDaySchedule | null>(null)
  const [loadingAssets, setLoadingAssets] = useState(true)
  const [loadingDay, setLoadingDay] = useState(false)
  const [busy, setBusy] = useState(false)

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

  async function refreshDay() {
    if (!rentalAssetId || !date) {
      return
    }
    const [templateList, daySchedule] = await Promise.all([
      listScheduleTemplates(rentalAssetId),
      fetchAdminScheduleDay(date, rentalAssetId),
    ])
    setTemplates(templateList)
    setDay(daySchedule)
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
    <div className="mx-auto w-full max-w-3xl space-y-6 p-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("rentals.schedule.title")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("rentals.schedule.description")}
        </p>
      </div>

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
              <section className="space-y-2">
                <h2 className="text-sm font-medium">
                  {t("rentals.schedule.templatesTitle", {
                    count: templates.length,
                  })}
                </h2>
                {templates.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {t("rentals.schedule.templatesEmpty")}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {t("rentals.schedule.templatesHint")}
                  </p>
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
