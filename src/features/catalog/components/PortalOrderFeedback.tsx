import "./portalOrders.css"

import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"

export function PortalOrderFeedbackIcon({ error = false }: { error?: boolean }) {
  return (
    <span className={`portal-order-feedback-icon${error ? " is-error" : ""}`} aria-hidden="true">
      <span className="portal-order-feedback-ring" />
      <svg viewBox="0 0 48 48" fill="none" focusable="false">
        <path pathLength="1" d={error ? "M16 16l16 16M32 16L16 32" : "M13 24l8 8 15-16"} />
      </svg>
    </span>
  )
}

export function PortalOrderSubmitError({ message, blocked, onRetry, onDismiss }: {
  message: string
  blocked: boolean
  onRetry: () => void
  onDismiss: () => void
}) {
  const { t } = useTranslation()
  return (
    <section role="alert" aria-labelledby="portal-order-error-title" className="portal-record-panel portal-order-error">
      <PortalOrderFeedbackIcon error />
      <div className="min-w-0 space-y-3">
        <h2 id="portal-order-error-title" className="font-semibold">{t("tenantPortal.catalog.purchase.errorTitle")}</h2>
        <p className="break-words text-sm text-muted-foreground">{message}</p>
        <div className="portal-order-feedback-actions">
          <Button type="button" variant="destructive" disabled={blocked} onClick={onRetry}>
            {t("tenantPortal.catalog.purchase.retry")}
          </Button>
          <Button type="button" variant="outline" onClick={onDismiss}>
            {t("tenantPortal.catalog.purchase.dismiss")}
          </Button>
        </div>
      </div>
    </section>
  )
}

export function PortalOrderSuccess({ number, catalogTo, onTrack, onDismiss }: {
  number: number
  catalogTo: string
  onTrack: () => void
  onDismiss: () => void
}) {
  const { t } = useTranslation()
  return (
    <section className="portal-record-panel portal-order-success" aria-labelledby="portal-order-success-title">
      <PortalOrderFeedbackIcon />
      <h2 id="portal-order-success-title">{t("tenantPortal.catalog.purchase.successTitle")}</h2>
      <p className="text-muted-foreground">{t("tenantPortal.catalog.purchase.orderNumber", { number })}</p>
      <p className="portal-order-success-copy">{t("tenantPortal.catalog.purchase.successCopy")}</p>
      <div className="portal-order-next">
        <h3>{t("tenantPortal.catalog.purchase.nextTitle")}</h3>
        <p>{t("tenantPortal.catalog.purchase.nextCopy")}</p>
      </div>
      <div className="portal-order-feedback-actions">
        <Button type="button" className="portal-order-track-button" onClick={onTrack}>
          {t("tenantPortal.catalog.purchase.track")}
        </Button>
        <Button type="button" variant="outline" render={<Link to={catalogTo} />}>
          {t("tenantPortal.catalog.purchase.continueShopping")}
        </Button>
        <Button type="button" variant="ghost" onClick={onDismiss}>
          {t("tenantPortal.catalog.purchase.dismiss")}
        </Button>
      </div>
    </section>
  )
}
