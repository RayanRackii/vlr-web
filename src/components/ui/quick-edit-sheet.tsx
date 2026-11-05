import { type ReactNode } from "react"
import { useTranslation } from "react-i18next"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { LoadingButton } from "@/components/ui/loading-button"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

type QuickEditSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: ReactNode
  onSave: () => void
  saving?: boolean
  saveDisabled?: boolean
  saveLabel?: string
  cancelLabel?: string
  /** Optional "Abrir edição completa →" link target. */
  fullEditHref?: string
  className?: string
}

/**
 * Compact edit surface: 480px wide on >=640px screens, full-screen on mobile,
 * with a sticky Cancelar/Salvar footer. Use for quick edits of a handful of
 * fields; link out to the full edit page for everything else.
 */
export function QuickEditSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  onSave,
  saving = false,
  saveDisabled = false,
  saveLabel,
  cancelLabel,
  fullEditHref,
  className,
}: QuickEditSheetProps) {
  const { t } = useTranslation()
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={cn(
          "w-full max-w-full sm:w-[480px] sm:max-w-[480px]",
          className,
        )}
      >
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          {description ? <SheetDescription>{description}</SheetDescription> : null}
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-4">{children}</div>
        {fullEditHref ? (
          <a
            href={fullEditHref}
            className="px-4 text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            {t("fullPage.openFullEdit")}
          </a>
        ) : null}
        <SheetFooter className="sticky bottom-0 flex-row justify-end gap-2">
          <SheetClose
            render={<Button type="button" variant="outline" />}
          >
            {cancelLabel ?? t("common.cancel")}
          </SheetClose>
          <LoadingButton
            type="button"
            loading={saving}
            disabled={saveDisabled}
            onClick={onSave}
          >
            {saveLabel ?? t("common.save")}
          </LoadingButton>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
