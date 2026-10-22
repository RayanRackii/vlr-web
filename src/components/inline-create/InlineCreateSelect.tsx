import { useState, type ComponentProps, type ReactNode } from "react"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

export type InlineCreateOption = { value: string; label: string }

type InlineCreateFormProps<TOption extends InlineCreateOption> = {
  complete: (option: TOption) => Promise<void>
  close: () => void
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
  renderCreateForm: (props: InlineCreateFormProps<TOption>) => ReactNode
} & Pick<
  ComponentProps<typeof SelectTrigger>,
  "id" | "aria-describedby" | "aria-invalid"
>

const CREATE_VALUE = "__inline-create__"

/**
 * A select that can create one of its dependencies without navigating away.
 * The consumer owns the small form and API mutation; this component owns the
 * drawer lifecycle, refreshed options and selecting the newly-created item.
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
  renderCreateForm,
  ...triggerProps
}: InlineCreateSelectProps<TOption>) {
  const [open, setOpen] = useState(false)
  async function complete(option: TOption) {
    await onRefreshOptions()
    onValueChange(option.value)
    setOpen(false)
  }

  return (
    <>
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
          onValueChange(nextValue)
        }}
        items={[
          ...options,
          ...(canCreate ? [{ value: CREATE_VALUE, label: createLabel }] : []),
        ]}
        disabled={disabled}
      >
        <SelectTrigger className="w-full" {...triggerProps}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
          {canCreate ? <SelectItem value={CREATE_VALUE}>{createLabel}</SelectItem> : null}
        </SelectContent>
      </Select>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader className="border-b border-border">
            <SheetTitle>{drawerTitle}</SheetTitle>
            {drawerDescription ? (
              <SheetDescription>{drawerDescription}</SheetDescription>
            ) : null}
          </SheetHeader>
          <div
            className="px-4 py-4"
            onSubmit={(event) => {
              event.preventDefault()
              event.stopPropagation()
            }}
          >
            {renderCreateForm({ complete, close: () => setOpen(false) })}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}

export function InlineCreateDrawerFooter({
  cancelLabel,
  saveLabel,
  isValid,
  busy,
  onCancel,
}: {
  cancelLabel: string
  saveLabel: string
  isValid: boolean
  busy: boolean
  onCancel: () => void
}) {
  return (
    <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
        {cancelLabel}
      </Button>
      <Button type="submit" disabled={!isValid || busy}>
        {saveLabel}
      </Button>
    </div>
  )
}
