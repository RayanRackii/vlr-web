import { Check, X } from "lucide-react"
import { useTranslation } from "react-i18next"
import { formatCatalogDate, type CatalogOrder, type CatalogOrderStatus } from "@/features/catalog/schemas/catalogSchemas"

const steps = ["Requested", "Approved", "Preparing", "Ready", "Completed"] as const

export function PortalOrderStepper({ order }: { order: CatalogOrder }) {
  const { t, i18n } = useTranslation()
  const terminal = order.status === "Cancelled" || order.status === "Rejected"
  const currentIndex = steps.findIndex((status) => status === order.status)
  const visibleSteps: readonly CatalogOrderStatus[] = terminal
    ? [...steps.filter((status) => status === "Requested" || order.history.some((entry) => entry.status === status)), order.status]
    : steps

  return (
    <>
      <ol className="portal-order-stepper" aria-label={t("tenantPortal.catalog.purchase.trackingTitle")}>
        {visibleSteps.map((status, index) => {
          const isTerminal = status === "Cancelled" || status === "Rejected"
          const done = !isTerminal && (terminal || index < currentIndex || order.status === "Completed")
          const current = !terminal && status === order.status && !done
          const entry = order.history.find((entry) => entry.status === status)
          const timestamp = entry?.createdAt ?? (status === "Requested" ? order.createdAt : null)
          return (
            <li key={status} className={`${done ? "is-done" : current ? "is-current" : isTerminal ? "is-terminal" : "is-upcoming"}`}
              aria-current={current ? "step" : undefined}>
              <span className="portal-order-step-node" aria-hidden="true">
                {isTerminal ? <X /> : done ? <Check /> : null}
              </span>
              <div className="portal-order-step-body">
                <h3>{t(`tenantPortal.catalog.purchase.${isTerminal ? "terminal" : "steps"}.${status}`)}</h3>
                <p>{t(`tenantPortal.catalog.purchase.stepCopy.${status}`)}</p>
                {timestamp ? <time dateTime={timestamp}>{formatCatalogDate(timestamp, i18n.language)}</time> : null}
                {isTerminal && !entry?.reason && (order.status === "Rejected" ? order.rejectedReason : order.cancelledReason) ? (
                  <p>{t("tenantPortal.catalog.purchase.reason", { reason: order.status === "Rejected" ? order.rejectedReason : order.cancelledReason })}</p>
                ) : null}
              </div>
            </li>
          )
        })}
      </ol>
      {order.history.length > 0 ? (
        <details className="portal-order-history">
          <summary>{t("catalog.orders.timeline")}</summary>
          <ol className="portal-timeline">
            {order.history.map((entry) => (
              <li key={entry.id} className="portal-timeline-entry">
                <span className="portal-timeline-rail" aria-hidden="true">
                  <span className="portal-timeline-dot" /><span className="portal-timeline-line" />
                </span>
                <div className="portal-timeline-body">
                  <p className="portal-timeline-status">{t(`catalog.status.${entry.status}`)}</p>
                  <p className="portal-timeline-when">{formatCatalogDate(entry.createdAt, i18n.language)}</p>
                  {entry.reason ? <p className="portal-timeline-reason">{t("tenantPortal.catalog.purchase.reason", { reason: entry.reason })}</p> : null}
                </div>
              </li>
            ))}
          </ol>
        </details>
      ) : null}
    </>
  )
}
