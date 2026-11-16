import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { LoadingButton } from "@/components/ui/loading-button"
import type { WorkOrder } from "@/features/workOrders/schemas/workOrderSchemas"
import { cancelWorkOrder } from "@/features/workOrders/services/workOrdersService"

type CancelWorkOrderDialogProps = {
  /** Work order to cancel; the dialog is closed while this is null. */
  workOrderId: string | null
  onOpenChange: (open: boolean) => void
  /** Called after the API confirmed the cancellation. */
  onCanceled: (workOrder: WorkOrder) => void
}

export function CancelWorkOrderDialog({
  workOrderId,
  onOpenChange,
  onCanceled,
}: CancelWorkOrderDialogProps) {
  const { t } = useTranslation()
  const [pending, setPending] = useState(false)

  async function confirm() {
    if (!workOrderId || pending) return
    setPending(true)
    try {
      const canceled = await cancelWorkOrder(workOrderId)
      toast.success(t("workOrders.cancel.success"))
      onOpenChange(false)
      onCanceled(canceled)
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : t("workOrders.errors.cancelFailed"),
      )
    } finally {
      setPending(false)
    }
  }

  return (
    <AlertDialog
      open={workOrderId !== null}
      onOpenChange={(open) => {
        if (!pending) onOpenChange(open)
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("workOrders.cancel.title")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("workOrders.cancel.description")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>
            {t("workOrders.cancel.back")}
          </AlertDialogCancel>
          <LoadingButton
            type="button"
            variant="destructive"
            loading={pending}
            onClick={() => void confirm()}
          >
            {t("workOrders.cancel.action")}
          </LoadingButton>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
