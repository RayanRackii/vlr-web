import { useCallback, useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useTenantTimeZone } from "@/contexts/TenantTimeZoneContext"
import { describeProductHistoryEntry, formatProductHistoryDate } from "@/features/catalog/lib/productHistoryText"
import type { CatalogProductHistoryEntry } from "@/features/catalog/schemas/catalogSchemas"
import { getCatalogProductHistory } from "@/features/catalog/services/catalogService"

export const PRODUCT_HISTORY_PAGE_SIZE = 20

/** Product history, newest first, paged with the (createdAt, id) cursor of the last entry. */
export function ProductHistoryTab({ productId, currency }: { productId: string; currency: string }) {
  const { t, i18n } = useTranslation()
  const timeZoneId = useTenantTimeZone()
  const [entries, setEntries] = useState<CatalogProductHistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const active = useRef(true)

  const loadFirst = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const page = await getCatalogProductHistory(productId, { limit: PRODUCT_HISTORY_PAGE_SIZE })
      if (!active.current) return
      setEntries(page)
      setHasMore(page.length >= PRODUCT_HISTORY_PAGE_SIZE)
    } catch (loadError) {
      if (active.current) setError(loadError instanceof Error ? loadError.message : t("catalog.products.view.history.loadError"))
    } finally {
      if (active.current) setLoading(false)
    }
  }, [productId, t])

  useEffect(() => {
    active.current = true
    void Promise.resolve().then(() => { if (active.current) void loadFirst() })
    return () => { active.current = false }
  }, [loadFirst])

  async function loadMore() {
    const last = entries.at(-1)
    if (!last || loadingMore) return
    setLoadingMore(true)
    setError(null)
    try {
      const page = await getCatalogProductHistory(productId, {
        limit: PRODUCT_HISTORY_PAGE_SIZE,
        cursor: { before: last.createdAt, beforeId: last.id },
      })
      if (!active.current) return
      setEntries((current) => [...current, ...page])
      setHasMore(page.length >= PRODUCT_HISTORY_PAGE_SIZE)
    } catch (loadError) {
      if (active.current) setError(loadError instanceof Error ? loadError.message : t("catalog.products.view.history.loadError"))
    } finally {
      if (active.current) setLoadingMore(false)
    }
  }

  if (loading) {
    return <Skeleton className="h-40 w-full" role="status" aria-label={t("common.loading")} />
  }

  return (
    <section aria-label={t("catalog.products.view.history.title")} className="space-y-4">
      {error != null ? (
        <p role="alert" className="text-sm text-destructive">{error}</p>
      ) : null}
      {entries.length === 0 && error == null ? (
        <p className="text-sm text-muted-foreground">{t("catalog.products.view.history.empty")}</p>
      ) : (
        <ol className="divide-y divide-border rounded-xl border border-border bg-card" data-testid="product-history-list">
          {entries.map((entry) => (
            <li key={entry.id} className="px-4 py-3 text-sm" data-testid="product-history-entry">
              <span className="break-words font-medium text-foreground">
                {describeProductHistoryEntry(entry, { t, locale: i18n.language, currency })}
              </span>
              <span className="text-muted-foreground">
                {" · "}
                {entry.actorName ?? t("catalog.products.view.history.system")}
                {" · "}
                {formatProductHistoryDate(entry.createdAt, i18n.language, timeZoneId)}
              </span>
            </li>
          ))}
        </ol>
      )}
      {hasMore ? (
        <Button type="button" variant="outline" className="min-h-11" disabled={loadingMore} onClick={() => void loadMore()}>
          {t("catalog.products.view.history.loadMore")}
        </Button>
      ) : null}
      {error != null && entries.length === 0 ? (
        <Button type="button" variant="outline" className="min-h-11" onClick={() => void loadFirst()}>
          {t("common.retry")}
        </Button>
      ) : null}
    </section>
  )
}
