import { useRef, type RefObject } from "react"
import { LockKeyhole, Pencil, Trash2, type LucideIcon } from "lucide-react"
import { useTranslation } from "react-i18next"

import { LoadingButton } from "@/components/ui/loading-button"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { PEOPLE_ICON_TILE } from "@/features/users/components/peopleRowStyles"

type PeopleMobileActionSheetProps = {
  open: boolean
  name: string
  description?: string | null
  icon: LucideIcon
  monospace?: boolean
  editSubtitle: string
  deleteSubtitle?: string
  canDelete: boolean
  locked?: boolean
  confirming: boolean
  confirmTitle: string
  confirmDescription: string
  isDeleting: boolean
  returnFocus: RefObject<HTMLButtonElement | null>
  restoreFocus: boolean
  onClose: () => void
  onEdit: () => void
  onRequestDelete: () => void
  onConfirmDelete: () => void
}

export function PeopleMobileActionSheet({
  open, name, description, icon: Icon, monospace, editSubtitle, deleteSubtitle,
  canDelete, locked, confirming, confirmTitle, confirmDescription, isDeleting,
  returnFocus, restoreFocus, onClose, onEdit, onRequestDelete, onConfirmDelete,
}: PeopleMobileActionSheetProps) {
  const { t } = useTranslation()
  const cancelRef = useRef<HTMLButtonElement | null>(null)

  return (
    <Sheet open={open} onOpenChange={(nextOpen) => { if (!nextOpen && !isDeleting) onClose() }}>
      <SheetContent
        side="bottom"
        aria-modal="true"
        showCloseButton={false}
        className="m-auto max-h-[calc(100dvh-2rem)] max-w-xl gap-0 overflow-y-auto rounded-b-none rounded-t-2xl border-0 bg-card px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2 text-card-foreground sm:bottom-6 sm:rounded-2xl"
        finalFocus={() => restoreFocus ? returnFocus.current : false}
      >
        <div className="mx-auto mb-3 mt-1 h-1.5 w-10 shrink-0 rounded-full bg-border" aria-hidden="true" />
        {confirming ? (
          <>
            <div className="text-center [&_[data-slot=sheet-description]]:mb-4 [&_[data-slot=sheet-title]]:mb-1 [&_[data-slot=sheet-title]]:text-lg">
              <div className="mx-auto mb-2.5 mt-1.5 grid size-12 place-items-center rounded-2xl bg-destructive/10 text-destructive [&_svg]:size-6"><Trash2 aria-hidden strokeWidth={1.75} /></div>
              <SheetTitle>{confirmTitle}</SheetTitle>
              <SheetDescription>{confirmDescription}</SheetDescription>
            </div>
            <LoadingButton className="min-h-12 rounded-xl font-semibold" variant="destructive" loading={isDeleting} onClick={onConfirmDelete}>
              {t("common.delete")}
            </LoadingButton>
          </>
        ) : (
          <>
            <div className="flex items-center gap-3 border-b border-border px-1 pb-3.5 pt-1">
              <span className={PEOPLE_ICON_TILE}><Icon aria-hidden strokeWidth={1.75} /></span>
              <div className="min-w-0">
                <SheetTitle>{name}</SheetTitle>
                {description ? <SheetDescription className={monospace ? "font-mono" : undefined}>{description}</SheetDescription> : null}
              </div>
            </div>
            <div className="pt-2">
              <button type="button" className="flex min-h-14 w-full items-center gap-3.5 rounded-xl p-2 text-left font-semibold outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring [&_small]:block [&_small]:text-xs [&_small]:font-normal [&_small]:text-muted-foreground [&_svg]:size-5 [&_svg]:shrink-0" onClick={onEdit}>
                <Pencil aria-hidden strokeWidth={1.75} />
                <span>{t("common.edit")}<small>{editSubtitle}</small></span>
              </button>
              {canDelete ? (
                <button type="button" className="flex min-h-14 w-full items-center gap-3.5 rounded-xl p-2 text-left font-semibold outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring [&_small]:block [&_small]:text-xs [&_small]:font-normal [&_small]:text-muted-foreground [&_svg]:size-5 [&_svg]:shrink-0 text-destructive" onClick={() => {
                  onRequestDelete()
                  cancelRef.current?.focus()
                }}>
                  <Trash2 aria-hidden strokeWidth={1.75} />
                  <span>{t("common.delete")}{deleteSubtitle ? <small>{deleteSubtitle}</small> : null}</span>
                </button>
              ) : null}
              {locked ? (
                <p className="flex min-h-14 w-full items-center gap-3.5 rounded-xl p-2 text-left font-semibold outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring [&_small]:block [&_small]:text-xs [&_small]:font-normal [&_small]:text-muted-foreground [&_svg]:size-5 [&_svg]:shrink-0 font-medium text-muted-foreground">
                  <LockKeyhole aria-hidden strokeWidth={1.75} />
                  <span>{t("rbac.errors.CANNOT_DELETE_SYSTEM_ROLE")}</span>
                </p>
              ) : null}
            </div>
          </>
        )}
        <button ref={cancelRef} type="button" className="mt-2.5 min-h-12 w-full shrink-0 rounded-xl border border-border font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring" disabled={isDeleting} onClick={onClose}>
          {t("common.cancel")}
        </button>
      </SheetContent>
    </Sheet>
  )
}
