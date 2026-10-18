import { useEffect, useState } from "react"
import { Link, useOutletContext, useParams } from "react-router-dom"
import { useTranslation } from "react-i18next"

import { PageContentSkeleton } from "@/components/loading/PageContentSkeleton"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { productRequestStatusLabel } from "@/features/catalog/lib/productRequestStatusLabel"
import {
  formatCatalogDate,
  type PortalProductRequest,
} from "@/features/catalog/schemas/catalogSchemas"
import { getPortalProductRequest } from "@/features/catalog/services/catalogPortalService"
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
  const [seenId, setSeenId] = useState(requestId)
  if (seenId !== requestId) {
    setSeenId(requestId)
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
  }, [i18n, reloadKey, requestId])

  const back = (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      render={
        <Link to={tenantPortalPath(subdomain, "catalogo/solicitacoes")} />
      }
    >
      {t("common.back")}
    </Button>
  )

  if (!requestId) {
    return (
      <div className="mx-auto max-w-xl space-y-6">
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
    <div className="mx-auto max-w-xl space-y-6">
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
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <h1 className="text-xl font-semibold tracking-tight">
                {t("tenantPortal.catalog.requestDetailTitle")}
              </h1>
              <p className="text-sm text-muted-foreground">
                {formatCatalogDate(request.createdAt, i18n.language)}
              </p>
            </div>
            <Badge variant="outline">
              {productRequestStatusLabel(request.status, (key) => t(key))}
            </Badge>
          </div>

          <p className="whitespace-pre-wrap text-sm">{request.description}</p>
          <p className="text-sm">
            {t("tenantPortal.catalog.quantity")}: {request.quantity}
          </p>

          <section className="space-y-2">
            <h2 className="text-sm font-medium">
              {t("tenantPortal.catalog.requestFilesTitle")}
            </h2>
            {request.files.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("tenantPortal.catalog.requestFilesEmpty")}
              </p>
            ) : (
              <ul className="divide-y rounded-xl border border-border">
                {request.files.map((file) => {
                  const href = httpFileUrl(file.url)
                  return (
                    <li key={file.id} className="px-4 py-3 text-sm">
                      {href ? (
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {file.fileName}
                        </a>
                      ) : (
                        <span>{file.fileName}</span>
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
