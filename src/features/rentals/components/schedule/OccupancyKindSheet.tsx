import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import {
  Ban,
  BookOpen,
  Calendar,
  CheckCircle2,
  Lock,
  Sparkles,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { FieldLabel } from "@/components/ui/field-label"
import { Input } from "@/components/ui/input"
import { LoadingButton } from "@/components/ui/loading-button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
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
}

export function OccupancyKindSheet({
  open,
  onOpenChange,
  editing,
  busy,
  readOnly,
  onSubmit,
}: OccupancyKindSheetProps) {
  const { t } = useTranslation()
  const [form, setForm] = useState<UpsertOccupancyKindInput>(emptyKindForm)
  const PreviewIcon =
    ICONS[(form.iconKey as (typeof ICON_KEYS)[number]) ?? "circle-check"] ??
    CheckCircle2

  useEffect(() => {
    if (!open) {
      return
    }
    if (editing) {
      setForm({
        key: editing.key,
        label: editing.label,
        description: editing.description ?? "",
        colorHex: editing.colorHex ?? "",
        iconKey: editing.iconKey ?? "circle-check",
        isBookableByCustomer: editing.isBookableByCustomer,
        blocksCapacity: editing.blocksCapacity,
        sortOrder: editing.sortOrder,
        isActive: editing.isActive,
      })
      return
    }
    setForm(emptyKindForm())
  }, [editing, open])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>
            {editing
              ? t("rentals.schedule.kinds.saveEdit")
              : t("rentals.schedule.kinds.saveCreate")}
          </SheetTitle>
          <SheetDescription>
            {t("rentals.schedule.kinds.description")}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4">
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
          <div className="space-y-1.5">
            <FieldLabel
              label={t("rentals.schedule.kinds.iconKey")}
              help={t("rentals.schedule.kinds.help.iconKey")}
            />
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              value={form.iconKey ?? "circle-check"}
              disabled={readOnly || busy}
              onChange={(event) => {
                setForm((current) => ({
                  ...current,
                  iconKey: event.target.value,
                }))
              }}
            >
              {ICON_KEYS.map((iconKey) => (
                <option key={iconKey} value={iconKey}>
                  {iconKey}
                </option>
              ))}
            </select>
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
              className="size-4 accent-primary"
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
              className="size-4 accent-primary"
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
              className="size-4 accent-primary"
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

        <SheetFooter>
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
            {editing
              ? t("rentals.schedule.kinds.saveEdit")
              : t("rentals.schedule.kinds.saveCreate")}
          </LoadingButton>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
