import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import {
  Ban,
  BookOpen,
  Calendar,
  CheckCircle2,
  Lock,
  Sparkles,
  Tag,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { FieldLabel } from "@/components/ui/field-label"
import { Input } from "@/components/ui/input"
import { LoadingButton } from "@/components/ui/loading-button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { InlineScheduleModule } from "@/features/rentals/components/schedule/InlineScheduleModule"
import { emptyKindForm } from "@/features/rentals/components/schedule/scheduleFormDefaults"
import type {
  OccupancyKind,
  UpsertOccupancyKindInput,
} from "@/features/rentals/services/scheduleService"

const ICON_KEYS = [
  "circle-check",
  "ban",
  "book-open",
  "wrench",
  "calendar",
  "users",
  "lock",
  "sparkles",
] as const

const ICONS: Record<(typeof ICON_KEYS)[number], LucideIcon> = {
  "circle-check": CheckCircle2,
  ban: Ban,
  "book-open": BookOpen,
  wrench: Wrench,
  calendar: Calendar,
  users: Users,
  lock: Lock,
  sparkles: Sparkles,
}

type OccupancyKindSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  editing: OccupancyKind | null
  busy: boolean
  readOnly: boolean
  onSubmit: (values: UpsertOccupancyKindInput) => Promise<boolean>
  onDirtyChange?: (dirty: boolean) => void
  /** Collapse and other non-Cancel closes. Cancel discards without asking. */
  onRequestClose?: () => void
}

function formFromKind(editing: OccupancyKind | null): UpsertOccupancyKindInput {
  if (!editing) return emptyKindForm()
  return {
    key: editing.key,
    label: editing.label,
    description: editing.description ?? "",
    colorHex: editing.colorHex ?? "",
    iconKey: editing.iconKey ?? "circle-check",
    isBookableByCustomer: editing.isBookableByCustomer,
    blocksCapacity: editing.blocksCapacity,
    sortOrder: editing.sortOrder,
    isActive: editing.isActive,
  }
}

function kindFormDirty(form: UpsertOccupancyKindInput, baseline: UpsertOccupancyKindInput): boolean {
  return form.key !== baseline.key
    || form.label !== baseline.label
    || (form.description ?? "") !== (baseline.description ?? "")
    || (form.colorHex ?? "") !== (baseline.colorHex ?? "")
    || (form.iconKey ?? "") !== (baseline.iconKey ?? "")
    || form.isBookableByCustomer !== baseline.isBookableByCustomer
    || form.blocksCapacity !== baseline.blocksCapacity
    || Number(form.sortOrder) !== Number(baseline.sortOrder)
    || form.isActive !== baseline.isActive
}

export function OccupancyKindSheet({
  open,
  onOpenChange,
  editing,
  busy,
  readOnly,
  onSubmit,
  onDirtyChange,
  onRequestClose,
}: OccupancyKindSheetProps) {
  const { t } = useTranslation()
  const [baseline] = useState(() => formFromKind(editing))
  const [form, setForm] = useState<UpsertOccupancyKindInput>(baseline)
  const PreviewIcon =
    ICONS[(form.iconKey as (typeof ICON_KEYS)[number]) ?? "circle-check"] ??
    CheckCircle2
  const dirty = kindFormDirty(form, baseline)
  const title = editing
    ? t("rentals.schedule.kinds.saveEdit")
    : t("rentals.schedule.kinds.saveCreate")

  useEffect(() => {
    onDirtyChange?.(open && dirty)
  }, [dirty, onDirtyChange, open])
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange])

  if (!open) return null

  return (
    <InlineScheduleModule
      title={title}
      description={t("rentals.schedule.kinds.description")}
      icon={Tag}
      open={open}
      disabled={busy}
      onOpenChange={(next) => {
        if (!next && onRequestClose) {
          onRequestClose()
          return
        }
        onOpenChange(next)
      }}
    >
        <div className="flex flex-col gap-5">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <FieldLabel
                label={t("rentals.schedule.kinds.key")}
                help={t("rentals.schedule.kinds.help.key")}
                required
              />
              <Input
                value={form.key}
                disabled={Boolean(editing) || readOnly || busy}
                placeholder={t("rentals.schedule.kinds.placeholders.key")}
                onChange={(event) => {
                  setForm((current) => ({
                    ...current,
                    key: event.target.value,
                  }))
                }}
              />
            </div>
            <div className="space-y-1.5">
              <FieldLabel
                label={t("rentals.schedule.kinds.label")}
                help={t("rentals.schedule.kinds.help.label")}
                required
              />
              <Input
                value={form.label}
                disabled={readOnly || busy}
                placeholder={t("rentals.schedule.kinds.placeholders.label")}
                onChange={(event) => {
                  setForm((current) => ({
                    ...current,
                    label: event.target.value,
                  }))
                }}
              />
            </div>
            <div className="space-y-1.5">
              <FieldLabel
                label={t("rentals.schedule.kinds.descriptionField")}
                help={t("rentals.schedule.kinds.help.description")}
              />
              <textarea
                className="min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                value={form.description ?? ""}
                disabled={readOnly || busy}
                onChange={(event) => {
                  setForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }}
              />
            </div>
          </div>

          <div className="space-y-4 border-t border-border pt-4">
            <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {t("rentals.schedule.kinds.appearanceSection")}
            </h3>
            <div className="space-y-1.5">
              <FieldLabel
                label={t("rentals.schedule.kinds.iconKey")}
                help={t("rentals.schedule.kinds.help.iconKey")}
              />
              <Select
                modal={false}
                value={form.iconKey ?? "circle-check"}
                disabled={readOnly || busy}
                onValueChange={(value) => {
                  if (typeof value === "string") {
                    setForm((current) => ({
                      ...current,
                      iconKey: value,
                    }))
                  }
                }}
                items={ICON_KEYS.map((iconKey) => ({
                  value: iconKey,
                  label: iconKey,
                }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ICON_KEYS.map((iconKey) => (
                    <SelectItem key={iconKey} value={iconKey}>
                      {iconKey}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <FieldLabel
                label={t("rentals.schedule.kinds.color")}
                help={t("rentals.schedule.kinds.help.color")}
              />
              <div className="flex items-center gap-3">
                <Input
                  type="color"
                  className="h-10 w-20 cursor-pointer p-1"
                  value={form.colorHex || "#22c55e"}
                  disabled={readOnly || busy}
                  onChange={(event) => {
                    setForm((current) => ({
                      ...current,
                      colorHex: event.target.value,
                    }))
                  }}
                />
                <div
                  className="flex h-10 min-w-0 flex-1 items-center rounded-md border px-3 text-sm"
                  style={{
                    borderColor: form.colorHex || "#22c55e",
                    backgroundColor: `${form.colorHex || "#22c55e"}20`,
                  }}
                >
                  <PreviewIcon className="mr-2 size-4 shrink-0" aria-hidden />
                  <span className="truncate">
                    {form.label || t("rentals.schedule.kinds.label")}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4 border-t border-border pt-4">
            <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {t("rentals.schedule.kinds.behaviorSection")}
            </h3>
            <div className="space-y-1.5">
              <FieldLabel
                label={t("rentals.schedule.kinds.sortOrder")}
                help={t("rentals.schedule.kinds.help.sortOrder")}
              />
              <Input
                type="number"
                value={form.sortOrder}
                disabled={readOnly || busy}
                onChange={(event) => {
                  setForm((current) => ({
                    ...current,
                    sortOrder: Number(event.target.value) || 0,
                  }))
                }}
              />
            </div>
            <div className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="touch-target size-4 accent-primary"
                checked={form.isBookableByCustomer}
                disabled={readOnly || busy}
                onChange={(event) => {
                  setForm((current) => ({
                    ...current,
                    isBookableByCustomer: event.target.checked,
                  }))
                }}
              />
              <FieldLabel
                label={t("rentals.schedule.kinds.bookable")}
                help={t("rentals.schedule.kinds.help.bookable")}
              />
            </div>
            <div className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="touch-target size-4 accent-primary"
                checked={form.blocksCapacity}
                disabled={readOnly || busy}
                onChange={(event) => {
                  setForm((current) => ({
                    ...current,
                    blocksCapacity: event.target.checked,
                  }))
                }}
              />
              <FieldLabel
                label={t("rentals.schedule.kinds.blocksCapacity")}
                help={t("rentals.schedule.kinds.help.blocksCapacity")}
              />
            </div>
            <div className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="touch-target size-4 accent-primary"
                checked={form.isActive}
                disabled={readOnly || busy}
                onChange={(event) => {
                  setForm((current) => ({
                    ...current,
                    isActive: event.target.checked,
                  }))
                }}
              />
              <FieldLabel
                label={t("rentals.schedule.active")}
                help={t("rentals.schedule.kinds.help.active")}
              />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => {
              onOpenChange(false)
            }}
          >
            {t("common.cancel")}
          </Button>
          <LoadingButton
            type="button"
            loading={busy}
            disabled={busy || readOnly}
            onClick={() => {
              void onSubmit(form).then((ok) => {
                if (ok) {
                  onOpenChange(false)
                }
              })
            }}
          >
            {title}
          </LoadingButton>
        </div>
    </InlineScheduleModule>
  )
}
