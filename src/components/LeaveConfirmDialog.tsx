import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type LeaveConfirmDialogProps = {
  open: boolean
  title: string
  onStay: () => void
  onLeave: () => void
}

/** In-app leave prompt. Cancel stays. The browser close warning stays native. */
export function LeaveConfirmDialog({ open, title, onStay, onLeave }: LeaveConfirmDialogProps) {
  const { t } = useTranslation()
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onStay() }}>
      <DialogContent role="alertdialog" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onStay}>
            {t("common.cancel")}
          </Button>
          <Button type="button" onClick={onLeave}>
            {t("fullPage.leave")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
