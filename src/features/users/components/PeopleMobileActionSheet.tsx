import { useRef, type RefObject } from "react"
import { LockKeyhole, Pencil, Trash2, type LucideIcon } from "lucide-react"
import { useTranslation } from "react-i18next"

import { LoadingButton } from "@/components/ui/loading-button"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import "@/features/users/people-access.css"

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
        className="people-action-sheet"
        finalFocus={() => restoreFocus ? returnFocus.current : false}
      >
        <div className="people-sheet-grab" aria-hidden="true" />
        {confirming ? (
          <>
            <div className="people-sheet-confirm">
              <div className="people-sheet-danger-icon"><Trash2 aria-hidden strokeWidth={1.75} /></div>
              <SheetTitle>{confirmTitle}</SheetTitle>
              <SheetDescription>{confirmDescription}</SheetDescription>
            </div>
            <LoadingButton className="people-sheet-delete" variant="destructive" loading={isDeleting} onClick={onConfirmDelete}>
              {t("common.delete")}
            </LoadingButton>
          </>
        ) : (
          <>
            <div className="people-sheet-heading">
              <span className="people-field-icon"><Icon aria-hidden strokeWidth={1.75} /></span>
              <div className="min-w-0">
                <SheetTitle>{name}</SheetTitle>
                {description ? <SheetDescription className={monospace ? "font-mono" : undefined}>{description}</SheetDescription> : null}
              </div>
            </div>
            <div className="people-sheet-actions">
              <button type="button" className="people-sheet-action" onClick={onEdit}>
                <Pencil aria-hidden strokeWidth={1.75} />
                <span>{t("common.edit")}<small>{editSubtitle}</small></span>
              </button>
              {canDelete ? (
                <button type="button" className="people-sheet-action people-sheet-destructive" onClick={() => {
                  onRequestDelete()
                  cancelRef.current?.focus()
                }}>
                  <Trash2 aria-hidden strokeWidth={1.75} />
                  <span>{t("common.delete")}{deleteSubtitle ? <small>{deleteSubtitle}</small> : null}</span>
                </button>
              ) : null}
              {locked ? (
                <p className="people-sheet-action people-sheet-locked">
                  <LockKeyhole aria-hidden strokeWidth={1.75} />
                  <span>{t("rbac.errors.CANNOT_DELETE_SYSTEM_ROLE")}</span>
                </p>
              ) : null}
            </div>
          </>
        )}
        <button ref={cancelRef} type="button" className="people-sheet-cancel" disabled={isDeleting} onClick={onClose}>
          {t("common.cancel")}
        </button>
      </SheetContent>
    </Sheet>
  )
}
