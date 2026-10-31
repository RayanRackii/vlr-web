import { useTenantTimeZone } from "@/contexts/TenantTimeZoneContext"
import "../components/portalOrders.css"

import { useEffect, useState } from "react"
import { Link, useOutletContext } from "react-router-dom"
import { ArrowRight, ClipboardList } from "lucide-react"
import { useTranslation } from "react-i18next"

import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { PortalStatusChip } from "@/features/catalog/components/PortalStatusChip"
import {
  portalProductRequestRange,
  productRequestStatusLabel,
} from "@/features/catalog/lib/productRequestStatusLabel"
import { formatCatalogDate } from "@/features/catalog/schemas/catalogSchemas"
import {
  listPortalProductRequests,
  type PortalProductRequestListResult,
} from "@/features/catalog/services/catalogPortalService"
import { productRequestStatusTone } from "@/features/catalog/lib/catalogStatusBadge"
import type { CustomerAppOutletContext } from "@/features/tenantPortal/components/CustomerAppLayout"
import { tenantPortalPath } from "@/features/tenantPortal/services/tenantPortalService"

export function PortalProductRequestsPage() {
  const { t, i18n } = useTranslation()
  const timeZoneId = useTenantTimeZone()
  const { subdomain, branding } = useOutletContext<CustomerAppOutletContext>()
  const [page, setPage] = useState(1)
  const [reloadKey, setReloadKey] = useState(0)
  const [result, setResult] = useState<PortalProductRequestListResult | null>(
    null,
  )
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void listPortalProductRequests(page)
      .then((data) => {
        if (!cancelled) {
          setResult(data)
          setLoadError(null)
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setResult(null)
          setLoadError(
            error instanceof Error
              ? error.message
              : i18n.t("apiErrors.loadPortalProductRequests"),
          )
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [i18n, page, reloadKey])

  const pageData = result?.kind === "ready" ? result.page : null
  const items = pageData?.items ?? []

  const range =
    pageData == null
      ? null
      : portalProductRequestRange(
          pageData.page,
          pageData.pageSize,
          pageData.total,
        )

  return (
    <div className="portal-records">
      <header className="portal-booking-header portal-records-header">
        <p className="portal-eyebrow break-words">{branding.displayName}</p>
        <h1>{t("tenantPortal.catalog.requestsTitle")}</h1>
        <p className="text-muted-foreground">
          {t("tenantPortal.catalog.requestsSubtitle")}
        </p>
      </header>

      {loading ? (
        <ul
          className="portal-records-list"
          role="status"
          aria-busy="true"
          aria-label={t("tenantPortal.catalog.requestsLoading")}
        >
          {[0, 1, 2].map((index) => (
            <li key={index} className="portal-record-card">
              <Skeleton className="size-[46px] shrink-0 rounded-full" aria-hidden />
              <div className="portal-record-body">
                <Skeleton className="h-4 w-48 max-w-full" />
                <Skeleton className="h-3 w-32 max-w-full" />
              </div>
              <Skeleton className="h-6 w-20 shrink-0 rounded-full" />
            </li>
          ))}
        </ul>
      ) : loadError ? (
        <div role="alert" className="space-y-4">
          <p className="text-sm text-destructive">{loadError}</p>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setLoading(true)
              setReloadKey((current) => current + 1)
            }}
          >
            {t("catalog.retry")}
          </Button>
        </div>
      ) : result?.kind === "unavailable" ? (
        <div role="status" className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {t("tenantPortal.catalog.requestsUnavailable")}
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setLoading(true)
              setReloadKey((current) => current + 1)
            }}
          >
            {t("catalog.retry")}
          </Button>
        </div>
      ) : pageData != null && pageData.total === 0 ? (
        <EmptyState
          variant="portal"
          icon={ClipboardList}
          title={t("tenantPortal.catalog.requestsEmpty")}
          description={t("tenantPortal.catalog.requestsEmptyDescription")}
          example={t("emptyStates.examples.portalRequests")}
          action={
            <Button
              type="button"
              className="portal-catalog-button portal-catalog-primary mt-2"
              render={<Link to={tenantPortalPath(subdomain, "catalogo/solicitar")} />}
            >
              {t("tenantPortal.catalog.requestCta")}
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          {items.length === 0 ? (
            <EmptyState
              variant="portal"
              icon={ClipboardList}
              title={t("tenantPortal.catalog.requestsPageEmpty")}
              action={page > 1 ? <Button onClick={() => { setLoading(true); setPage(1) }}>{t("emptyStates.firstPage")}</Button> : undefined}
            />
          ) : (
            <ul className="portal-records-list">
              {items.map((request) => (
                <li key={request.id}>
                  <Link
                    className="portal-record-card"
                    to={tenantPortalPath(
                      subdomain,
                      `catalogo/solicitacoes/${request.id}`,
                    )}
                  >
                    <span className="portal-record-icon" aria-hidden>
                      <ClipboardList strokeWidth={1.75} />
                    </span>
                    <span className="portal-record-body">
                      <span className="portal-record-top">
                        <span className="portal-record-title line-clamp-2">
                          {request.description}
                        </span>
                        <PortalStatusChip
                          tone={productRequestStatusTone(request.status)}
                        >
                          {productRequestStatusLabel(
                            request.status,
                            (key, options) => t(key, options),
                          )}
                        </PortalStatusChip>
                      </span>
                      <span className="portal-record-meta">
                        {formatCatalogDate(request.createdAt, i18n.language, timeZoneId)}
                        {" · "}
                        {t("catalog.requests.columns.quantity")}{" "}
                        {request.quantity}
                      </span>
                      <span className="portal-record-foot">
                        <span className="portal-record-view">
                          {t("catalog.orders.view")}
                          <ArrowRight aria-hidden />
                        </span>
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {range != null && range.pageCount > 1 ? (
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                {t("tenantPortal.catalog.requestsPageSummary", {
                  from: range.from,
                  to: range.to,
                  total: pageData?.total ?? 0,
                })}
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => {
                    setLoading(true)
                    setPage((current) => Math.max(1, current - 1))
                  }}
                >
                  {t("tenantPortal.catalog.requestsPrevious")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page >= range.pageCount}
                  onClick={() => {
                    setLoading(true)
                    setPage((current) => current + 1)
                  }}
                >
                  {t("tenantPortal.catalog.requestsNext")}
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
