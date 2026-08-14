import { CheckCircle2 } from "lucide-react"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import { Input } from "@/components/ui/input"
import { LoadingButton } from "@/components/ui/loading-button"
import type { ScheduleBusyAction } from "@/features/rentals/components/schedule/DailyAgendaTab"
import {
  formatScheduleTime,
  type AdminRentalAsset,
  type SchedulePolicy,
  type UpdateSchedulePolicyInput,
} from "@/features/rentals/services/scheduleService"
import { cn } from "@/lib/utils"

type SchedulePolicyPanelProps = {
  assets: readonly AdminRentalAsset[]
  busy: boolean
  busyAction: ScheduleBusyAction
  readOnly: boolean
  onSave: (input: UpdateSchedulePolicyInput) => Promise<void>
  onSeedSlotGrid: () => void
}

function toTimeInput(value: string | null | undefined, fallback: string): string {
  if (!value) {
    return fallback
  }
  return formatScheduleTime(value)
}

function durationInput(asset: AdminRentalAsset): string {
  return asset.allowedDurationMinutes?.split(",")[0]?.trim() || "60"
}

function isMixedPolicy(assets: readonly AdminRentalAsset[]): boolean {
  if (assets.length <= 1) {
    return false
  }
  const policies = new Set(
    assets.map((asset) => asset.schedulePolicy ?? "SlotGrid"),
  )
  return policies.size > 1
}

export function SchedulePolicyPanel({
  assets,
  busy,
  busyAction,
  readOnly,
  onSave,
  onSeedSlotGrid,
}: SchedulePolicyPanelProps) {
  const mixed = useMemo(() => isMixedPolicy(assets), [assets])
  const selectionKey = assets
    .map(
      (asset) =>
        `${asset.id}:${asset.schedulePolicy ?? "SlotGrid"}:${asset.openTime ?? ""}:${asset.closeTime ?? ""}:${asset.allowedDurationMinutes ?? ""}`,
    )
    .sort()
    .join("|")

  if (assets.length === 0) {
    return null
  }

  return (
    <SchedulePolicyPanelForm
      key={selectionKey}
      assets={assets}
      mixed={mixed}
      busy={busy}
      busyAction={busyAction}
      readOnly={readOnly}
      onSave={onSave}
      onSeedSlotGrid={onSeedSlotGrid}
    />
  )
}

function SchedulePolicyPanelForm({
  assets,
  mixed,
  busy,
  busyAction,
  readOnly,
  onSave,
  onSeedSlotGrid,
}: SchedulePolicyPanelProps & { mixed: boolean }) {
  const { t } = useTranslation()
  const first = assets[0]
  const [policy, setPolicy] = useState<SchedulePolicy | null>(
    mixed ? null : (first?.schedulePolicy ?? "SlotGrid"),
  )
  const [openTime, setOpenTime] = useState(
    toTimeInput(first?.openTime, "08:00"),
  )
  const [closeTime, setCloseTime] = useState(
    toTimeInput(first?.closeTime, "22:00"),
  )
  const [durationMinutes, setDurationMinutes] = useState(
    first ? durationInput(first) : "60",
  )

  return (
    <div className="space-y-4 rounded-lg border border-border bg-background p-4 shadow-sm">
      <div className="space-y-1">
        <h2 className="text-sm font-medium">
          {t("rentals.schedule.policy.title")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("rentals.schedule.policy.description")}
        </p>
        {mixed ? (
          <p className="rounded-md bg-muted px-3 py-2 text-sm text-foreground">
            <span className="font-medium">
              {t("rentals.schedule.policy.mixedTitle")}
            </span>{" "}
            {t("rentals.schedule.policy.mixedDescription")}
          </p>
        ) : null}
        {assets.length > 1 ? (
          <p className="text-xs text-muted-foreground">
            {t("rentals.schedule.policy.applyToSelected", {
              count: assets.length,
            })}
          </p>
        ) : null}
      </div>

      <div className="grid gap-2">
        {(
          [
            {
              id: "OpenHours" as const,
              title: t("rentals.schedule.policy.openHours"),
              hint: t("rentals.schedule.policy.openHoursHint"),
            },
            {
              id: "SlotGrid" as const,
              title: t("rentals.schedule.policy.slotGrid"),
              hint: t("rentals.schedule.policy.slotGridHint"),
            },
          ] as const
        ).map((option) => {
          const active = policy === option.id
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={active}
              disabled={busy || readOnly}
              onClick={() => {
                setPolicy(option.id)
              }}
              className={cn(
                "rounded-lg border px-3 py-3 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60",
                active
                  ? "border-primary bg-primary/10 ring-1 ring-primary/20"
                  : "border-border hover:border-primary/40",
              )}
            >
              <span className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium">{option.title}</span>
                {active ? (
                  <CheckCircle2
                    className="size-4 shrink-0 text-primary"
                    aria-hidden
                  />
                ) : null}
              </span>
              <p className="mt-1 text-xs text-muted-foreground">{option.hint}</p>
            </button>
          )
        })}
      </div>

      {policy === "OpenHours" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="min-w-0 space-y-1.5 text-sm">
            <span className="font-medium">{t("rentals.schedule.policy.openTime")}</span>
            <Input
              type="time"
              value={openTime}
              disabled={busy || readOnly}
              onChange={(event) => {
                setOpenTime(event.target.value)
              }}
            />
          </label>
          <label className="min-w-0 space-y-1.5 text-sm">
            <span className="font-medium">{t("rentals.schedule.policy.closeTime")}</span>
            <Input
              type="time"
              value={closeTime}
              disabled={busy || readOnly}
              onChange={(event) => {
                setCloseTime(event.target.value)
              }}
            />
          </label>
          <label className="min-w-0 space-y-1.5 text-sm">
            <span className="font-medium">
              {t("rentals.schedule.policy.slotMinutes")}
            </span>
            <Input
              type="number"
              min={15}
              step={15}
              value={durationMinutes}
              disabled={busy || readOnly}
              onChange={(event) => {
                setDurationMinutes(event.target.value)
              }}
            />
          </label>
          <LoadingButton
            type="button"
            className="w-full self-end"
            disabled={busy || readOnly}
            loading={busyAction === "policy"}
            onClick={() => {
              void onSave({
                schedulePolicy: "OpenHours",
                openTime,
                closeTime,
                allowedDurationMinutes: durationMinutes || "60",
              })
            }}
          >
            {t("rentals.schedule.policy.saveOpenHours")}
          </LoadingButton>
        </div>
      ) : null}

      {policy === "SlotGrid" ? (
        <div className="space-y-2">
          <LoadingButton
            type="button"
            className="w-full"
            disabled={busy || readOnly}
            loading={busyAction === "seed" || busyAction === "policy"}
            onClick={() => {
              void onSave({
                schedulePolicy: "SlotGrid",
                openTime: null,
                closeTime: null,
                allowedDurationMinutes: null,
              })
                .then(() => {
                  onSeedSlotGrid()
                })
                .catch(() => {
                  /* toast already shown by parent */
                })
            }}
          >
            {t("rentals.schedule.seedTemplates")}
          </LoadingButton>
          <LoadingButton
            type="button"
            variant="outline"
            className="w-full"
            disabled={busy || readOnly}
            loading={busyAction === "policy"}
            onClick={() => {
              void onSave({
                schedulePolicy: "SlotGrid",
                openTime: null,
                closeTime: null,
                allowedDurationMinutes: null,
              })
            }}
          >
            {t("rentals.schedule.policy.saveSlotGrid")}
          </LoadingButton>
          <p className="text-xs text-muted-foreground">
            {t("rentals.schedule.policy.slotGridSeedHint")}
          </p>
        </div>
      ) : null}
    </div>
  )
}
