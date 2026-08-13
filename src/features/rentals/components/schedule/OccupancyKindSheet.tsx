import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

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

  useEffect(() => {
    if (!open) {
      return
    }
    if (editing) {
      setForm({
        key: editing.key,
        label: editing.label,
        colorHex: editing.colorHex ?? "",
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
