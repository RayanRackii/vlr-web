import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { LoadingButton } from "@/components/ui/loading-button"
import { cn } from "@/lib/utils"

type SaveBarBaseProps = {
  /** Save stays disabled until the form is dirty. */
  dirty: boolean
  /** Shows the unsaved-changes text (with the count) while dirty; omit to hide it. */
  unsavedCount?: number
  saving?: boolean
  /** When false (create pages), Save is enabled by !saveDisabled alone. Default true. */
  saveRequiresDirty?: boolean
  /** Disable Save while keeping the bar visible (e.g. invalid fields). */
  saveDisabled?: boolean
  saveLabel?: string
  /** Label shown on Save while saving (defaults to the save label). */
  savingLabel?: string
  discardLabel?: string
  onDiscard?: () => void
  className?: string
}

export type SaveBarProps = SaveBarBaseProps & {
  onSave?: () => void
  /** Id of the form this bar submits; Save becomes type="submit" form={id}. */
  submitFormId?: string
}

/**
 * Sticky bottom bar: unsaved count, Discard and Save. Mobile stacks full-width
 * buttons with the primary action first; md+ is a right-aligned row.
 */
export function SaveBar({
  dirty,
  unsavedCount,
  saving = false,
  saveRequiresDirty = true,
  saveDisabled = false,
  saveLabel,
  savingLabel,
  discardLabel,
  onDiscard,
  onSave,
  submitFormId,
  className,
}: SaveBarProps) {
  const { t } = useTranslation()
  const label = saveLabel ?? t("fullPage.save")
  const hasSave = Boolean(submitFormId) || Boolean(onSave)

  return (
    <div
      className={cn(
        "sticky bottom-0 z-40 mt-4 border-t border-border bg-background/95 p-3 shadow-lg backdrop-blur supports-backdrop-filter:bg-background/80",
        className,
      )}
    >
      <div className="flex flex-col gap-3 px-2 md:flex-row md:items-center">
        {dirty && unsavedCount !== undefined ? (
          <span className="text-sm text-muted-foreground">
            {t("fullPage.unsavedChanges", { count: unsavedCount })}
          </span>
        ) : null}
        <div className="flex flex-col-reverse gap-2 md:ml-auto md:flex-row md:items-center">
          {onDiscard ? (
            <Button
              type="button"
              variant="ghost"
              className="min-h-11 w-full md:w-auto"
              disabled={saving}
              onClick={onDiscard}
            >
              {discardLabel ?? t("fullPage.discard")}
            </Button>
          ) : null}
          {hasSave ? (
            <LoadingButton
              type={submitFormId ? "submit" : "button"}
              form={submitFormId}
              className="min-h-11 w-full md:w-auto"
              loading={saving}
              loadingLabel={savingLabel}
              disabled={(saveRequiresDirty && !dirty) || saveDisabled}
              onClick={submitFormId ? undefined : onSave}
            >
              {label}
            </LoadingButton>
          ) : null}
        </div>
      </div>
    </div>
  )
}
