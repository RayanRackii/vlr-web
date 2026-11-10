import { useEffect, useId, useState, type ComponentProps, type ReactNode } from "react"
import { useTranslation } from "react-i18next"

import { LeaveConfirmDialog } from "@/components/LeaveConfirmDialog"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export type InlineCreateOption = { value: string; label: string }

type InlineCreateFormProps<TOption extends InlineCreateOption> = {
  complete: (option: TOption) => Promise<void>
  close: () => void
  reportDirty: (dirty: boolean) => void
}

type InlineCreateSelectProps<TOption extends InlineCreateOption> = {
  value: string
  onValueChange: (value: string) => void
  options: readonly TOption[]
  onRefreshOptions: () => Promise<readonly TOption[]>
  placeholder: string
  createLabel: string
  drawerTitle: string
  drawerDescription?: string
  disabled?: boolean
  canCreate?: boolean
  showScrollButtons?: boolean
  triggerIcon?: ReactNode
  onDirtyChange?: (dirty: boolean) => void
  renderCreateForm: (props: InlineCreateFormProps<TOption>) => ReactNode
} & Pick<
  ComponentProps<typeof SelectTrigger>,
  "id" | "aria-describedby" | "aria-invalid"
>

const CREATE_VALUE = "__inline-create__"

/**
 * A select that can create one of its dependencies without navigating away.
 * The consumer owns the small form and API mutation; this component expands
 * that form under the select, refreshes the options and selects the new item.
 */
export function InlineCreateSelect<TOption extends InlineCreateOption>({
  value,
  onValueChange,
  options,
  onRefreshOptions,
  placeholder,
  createLabel,
  drawerTitle,
  drawerDescription,
  disabled = false,
  canCreate = true,
  showScrollButtons = true,
  triggerIcon,
  onDirtyChange,
  renderCreateForm,
  ...triggerProps
}: InlineCreateSelectProps<TOption>) {
  const { t } = useTranslation()
  const titleId = useId()
  const [open, setOpen] = useState(false)
  const [draftDirty, setDraftDirty] = useState(false)
  const [pendingValue, setPendingValue] = useState<string | null>(null)

  useEffect(() => {
    onDirtyChange?.(open && draftDirty)
  }, [draftDirty, onDirtyChange, open])
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange])

  function discard() {
    setDraftDirty(false)
    setOpen(false)
  }

  async function complete(option: TOption) {
    await onRefreshOptions()
    onValueChange(option.value)
    discard()
  }

  function choose(nextValue: string) {
    setPendingValue(null)
    setDraftDirty(false)
    setOpen(false)
    onValueChange(nextValue)
  }

  return (
    <div className="space-y-3">
      <Select
        modal={false}
        value={value}
        onValueChange={(nextValue) => {
          if (nextValue === null) {
            return
          }
          if (nextValue === CREATE_VALUE) {
            setOpen(true)
            return
          }
          if (open && draftDirty) {
            setPendingValue(nextValue)
            return
          }
          choose(nextValue)
        }}
        items={[
          ...options,
          ...(canCreate ? [{ value: CREATE_VALUE, label: createLabel }] : []),
        ]}
        disabled={disabled}
      >
        <SelectTrigger className="w-full" {...triggerProps}>
          <SelectValue placeholder={placeholder} />
          {triggerIcon}
        </SelectTrigger>
        <SelectContent showScrollButtons={showScrollButtons}>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
          {canCreate ? <SelectItem value={CREATE_VALUE}>{createLabel}</SelectItem> : null}
        </SelectContent>
      </Select>

      {open ? (
        <section aria-labelledby={titleId} className="rounded-xl border border-border bg-card p-4">
          <h3 id={titleId} className="text-sm font-semibold">{drawerTitle}</h3>
          {drawerDescription ? (
            <p className="mt-1 text-xs text-muted-foreground">{drawerDescription}</p>
          ) : null}
          <div
            className="mt-4"
            onSubmit={(event) => {
              event.preventDefault()
              event.stopPropagation()
            }}
          >
            {renderCreateForm({
              complete,
              close: discard,
              reportDirty: setDraftDirty,
            })}
          </div>
        </section>
      ) : null}

      <LeaveConfirmDialog
        open={pendingValue != null}
        title={t("fullPage.leaveConfirm")}
        onStay={() => setPendingValue(null)}
        onLeave={() => {
          if (pendingValue) choose(pendingValue)
        }}
      />
    </div>
  )
}

export function InlineCreateDrawerFooter({
  cancelLabel,
  saveLabel,
  isValid,
  busy,
  onCancel,
  onSave,
}: {
  cancelLabel: string
  saveLabel: string
  isValid: boolean
  busy: boolean
  onCancel: () => void
  onSave: () => void
}) {
  return (
    <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
        {cancelLabel}
      </Button>
      <Button type="button" onClick={onSave} disabled={!isValid || busy}>
        {saveLabel}
      </Button>
    </div>
  )
}
