import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { LoadingButton } from "@/components/ui/loading-button"
import { canCancelCatalogItem, type PortalCatalogPolicy } from "@/features/catalog/schemas/catalogPolicySchemas"
import { getPortalCatalogPolicy } from "@/features/catalog/services/catalogPortalService"

type Props = {
  kind: "orders" | "requests"
  status: string
  cancel: () => Promise<void>
}

/** Mount with an item/tenant key so an old policy or pending mutation cannot cross details. */
export function PortalCancelAction({ kind, status, cancel }: Props) {
  const { t } = useTranslation()
  const [policy, setPolicy] = useState<PortalCatalogPolicy | null>(null)
  const [policyError, setPolicyError] = useState<string | null>(null)
  const [cancelError, setCancelError] = useState<string | null>(null)
  const [retry, setRetry] = useState(0)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const activeRef = useRef(true)
  useEffect(() => {
    activeRef.current = true
    return () => { activeRef.current = false }
  }, [])
  useEffect(() => {
    let stale = false
    setPolicy(null)
    setPolicyError(null)
    void getPortalCatalogPolicy().then((data) => { if (!stale) setPolicy(data) })
      .catch((error: unknown) => {
        if (!stale) setPolicyError(error instanceof Error ? error.message : t("catalog.policy.loadError"))
      })
    return () => { stale = true }
  }, [retry, t])
  const allowed = policy !== null && canCancelCatalogItem(policy, kind, status)
  async function confirm() {
    if (!allowed || busyRef.current) return
    busyRef.current = true
    setBusy(true)
    setCancelError(null)
    try {
      await cancel()
      if (!activeRef.current) return
      setOpen(false)
      toast.success(t(kind === "orders" ? "tenantPortal.catalog.orderCancelled" : "tenantPortal.catalog.requestCancelled"))
    } catch (error) {
      if (!activeRef.current) return
      const message = error instanceof Error ? error.message : t(kind === "orders" ? "apiErrors.cancelPortalOrder" : "tenantPortal.catalog.cancelRequestError")
      setCancelError(message)
      toast.error(message)
    } finally {
      busyRef.current = false
      if (activeRef.current) setBusy(false)
    }
  }
  if (policyError) return <div role="alert" className="space-y-2">
    <p className="text-sm text-destructive">{policyError}</p>
    <Button variant="outline" onClick={() => setRetry((value) => value + 1)}>{t("catalog.retry")}</Button>
  </div>
  if (!allowed) return null
  return <>
    <LoadingButton variant="outline" loading={busy} onClick={() => { setCancelError(null); setOpen(true) }}>{t(kind === "orders" ? "tenantPortal.catalog.cancelOrder" : "tenantPortal.catalog.cancelRequest")}</LoadingButton>
    <AlertDialog open={open} onOpenChange={(value) => { if (!busyRef.current) setOpen(value) }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t(kind === "orders" ? "tenantPortal.catalog.cancelConfirmTitle" : "tenantPortal.catalog.cancelRequestTitle")}</AlertDialogTitle>
          <AlertDialogDescription>{t(kind === "orders" ? "tenantPortal.catalog.cancelConfirmBody" : "tenantPortal.catalog.cancelRequestBody")}</AlertDialogDescription>
        </AlertDialogHeader>
        {policy.policyText ? <p className="whitespace-pre-wrap break-words text-sm">{policy.policyText}</p> : null}
        {cancelError ? <p role="alert" className="text-sm text-destructive">{cancelError}</p> : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>{t("tenantPortal.catalog.cancelConfirmDismiss")}</AlertDialogCancel>
          <LoadingButton variant="destructive" loading={busy} loadingLabel={t("tenantPortal.catalog.cancelling")} onClick={() => { void confirm() }}>{t("tenantPortal.catalog.cancelConfirmAction")}</LoadingButton>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>
}
