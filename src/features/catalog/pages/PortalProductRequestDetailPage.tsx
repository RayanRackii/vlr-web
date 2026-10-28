import "../components/portalOrders.css"

import { useEffect, useState } from "react"
import { Link, useOutletContext, useParams } from "react-router-dom"
import { ArrowLeft, Paperclip } from "lucide-react"
import { useTranslation } from "react-i18next"

import { PageContentSkeleton } from "@/components/loading/PageContentSkeleton"
import { Button } from "@/components/ui/button"
import { PortalStatusChip } from "@/features/catalog/components/PortalStatusChip"
import { productRequestStatusTone } from "@/features/catalog/lib/catalogStatusBadge"
import { productRequestStatusLabel } from "@/features/catalog/lib/productRequestStatusLabel"
import {
  formatCatalogDate,
  type PortalProductRequest,
} from "@/features/catalog/schemas/catalogSchemas"
import { PortalCancelAction } from "@/features/catalog/components/PortalCancelAction"
import { cancelPortalProductRequest, getPortalProductRequest } from "@/features/catalog/services/catalogPortalService"
import type { CustomerAppOutletContext } from "@/features/tenantPortal/components/CustomerAppLayout"
import { tenantPortalPath } from "@/features/tenantPortal/services/tenantPortalService"

function httpFileUrl(url: string): string | null {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return null
    }
    return parsed.href
  } catch {
    return null
  }
}

export function PortalProductRequestDetailPage() {
  const { t, i18n } = useTranslation()
  const params = useParams()
  const { subdomain } = useOutletContext<CustomerAppOutletContext>()
  const requestId = params.requestId ?? ""
  const [reloadKey, setReloadKey] = useState(0)
  const [request, setRequest] = useState<PortalProductRequest | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const identity = `${subdomain}:${requestId}`
  const [seenId, setSeenId] = useState(identity)
  if (seenId !== identity) {
    setSeenId(identity)
    setLoading(true)
    setRequest(null)
    setLoadError(null)
  }

  useEffect(() => {
    if (!requestId) {
      return
    }

    let cancelled = false
    void getPortalProductRequest(requestId)
      .then((data) => {
        if (!cancelled) {
          setRequest(data)
          setLoadError(null)
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setRequest(null)
          setLoadError(
            error instanceof Error
              ? error.message
              : i18n.t("apiErrors.loadPortalProductRequest"),
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
  }, [i18n, reloadKey, requestId, subdomain])

  const back = (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="portal-record-back"
      render={
        <Link to={tenantPortalPath(subdomain, "catalogo/solicitacoes")} />
      }
    >
      <ArrowLeft aria-hidden data-icon="inline-start" />
      {t("common.back")}
    </Button>
  )

  if (!requestId) {
    return (
      <div className="portal-record-detail space-y-4">
        {back}
        <div role="alert">
          <p className="text-sm text-destructive">
            {t("apiErrors.loadPortalProductRequest")}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="portal-record-detail space-y-4">
      {back}

      {loading ? (
        <PageContentSkeleton rows={4} />
      ) : loadError || !request ? (
        <div role="alert" className="space-y-4">
          <p className="text-sm text-destructive">
            {loadError ?? i18n.t("apiErrors.loadPortalProductRequest")}
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
      ) : (
        <>
          <section className="portal-record-panel space-y-5">
            <div className="portal-record-panel-head">
              <div className="space-y-1">
                <p className="portal-eyebrow">
                  {t("tenantPortal.catalog.navRequests")}
                </p>
                <h1>{t("tenantPortal.catalog.requestDetailTitle")}</h1>
                <p className="text-sm text-muted-foreground">
                  {formatCatalogDate(request.createdAt, i18n.language)}
                </p>
              </div>
              <PortalStatusChip tone={productRequestStatusTone(request.status)}>
                {productRequestStatusLabel(request.status, (key, options) =>
                  t(key, options),
                )}
              </PortalStatusChip>
            </div>

            <PortalCancelAction key={`${subdomain}:${request.id}`} kind="requests" status={request.status} cancel={async () => {
              const next = await cancelPortalProductRequest(request.id)
              // Cancel returns metadata without the signed file URLs from the read model.
              setRequest((current) => current?.id === next.id ? { ...current, status: next.status } : current)
            }} />

            <div className="space-y-1">
              <h2 className="portal-record-section-title">
                {t("tenantPortal.catalog.requestDescription")}
              </h2>
              <p className="whitespace-pre-wrap break-words text-sm">
                {request.description}
              </p>
            </div>
            <p className="text-sm">
              {t("tenantPortal.catalog.quantity")}: {request.quantity}
            </p>

            {(request.note ?? request.observation)?.trim() ? (
              <div className="space-y-1">
                <h2 className="portal-record-section-title">
                  {t("tenantPortal.catalog.requestNote")}
                </h2>
                <p className="whitespace-pre-wrap break-words text-sm">
                  {request.note ?? request.observation}
                </p>
              </div>
            ) : null}
          </section>

          <section className="portal-record-panel space-y-3">
            <h2 className="portal-record-section-title">
              {t("tenantPortal.catalog.requestFilesTitle")}
            </h2>
            {request.files.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("tenantPortal.catalog.requestFilesEmpty")}
              </p>
            ) : (
              <ul className="portal-record-files">
                {request.files.map((file) => {
                  const href = httpFileUrl(file.url)
                  return (
                    <li key={file.id} className="portal-record-file">
                      <Paperclip
                        aria-hidden
                        className="size-4 shrink-0 text-muted-foreground"
                      />
                      {href ? (
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="min-w-0 truncate underline-offset-2 hover:underline"
                        >
                          {file.fileName}
                        </a>
                      ) : (
                        <span className="min-w-0 truncate">{file.fileName}</span>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  )
}
