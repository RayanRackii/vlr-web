import { useCallback, useEffect, useRef, useState } from "react"
import { Users } from "lucide-react"
import { useTranslation } from "react-i18next"

import { PageContentSkeleton } from "@/components/loading/PageContentSkeleton"
import { Badge } from "@/components/ui/badge"
import { PeopleEmptyState } from "@/features/users/components/PeopleEmptyState"
import {
  DIRECTORY_PAGE_SIZE,
  PeoplePager,
  PeopleSearchForm,
} from "@/features/users/components/PeopleDirectoryControls"
import type { TenantCustomer } from "@/features/users/schemas/userSchemas"
import { isCanceledRequest } from "@/features/users/services/requestCancellation"
import { listTenantCustomers } from "@/features/users/services/usersService"

function formatCreatedAt(value: string, language: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat(language, {
    timeZone: "UTC",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date)
}

export function PeopleCustomersTab() {
  const { t, i18n } = useTranslation()
  const [customers, setCustomers] = useState<TenantCustomer[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState("")
  const [appliedQuery, setAppliedQuery] = useState("")
  const [searchError, setSearchError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const latestRequestRef = useRef(0)
  const abortRef = useRef<AbortController | null>(null)

  const loadCustomers = useCallback(async () => {
    const requestId = ++latestRequestRef.current
    const controller = new AbortController()
    const previous = abortRef.current
    abortRef.current = controller
    previous?.abort()

    setIsLoading(true)
    setLoadError(null)

    try {
      const data = await listTenantCustomers(
        {
          q: appliedQuery.length >= 2 ? appliedQuery : undefined,
          page,
          pageSize: DIRECTORY_PAGE_SIZE,
        },
        controller.signal,
      )
      if (requestId !== latestRequestRef.current) {
        return
      }
      setCustomers(data.items)
      setTotal(data.total)
    } catch (error: unknown) {
      if (requestId !== latestRequestRef.current || isCanceledRequest(error)) {
        return
      }
      setCustomers([])
      setTotal(0)
      setLoadError(
        error instanceof Error
          ? error.message
          : t("peopleAccess.errors.loadCustomers"),
      )
    } finally {
      if (requestId === latestRequestRef.current) {
        setIsLoading(false)
      }
    }
  }, [appliedQuery, page, t])

  useEffect(() => {
    void loadCustomers()
    return () => {
      latestRequestRef.current += 1
      abortRef.current?.abort()
    }
  }, [loadCustomers])

  function submitSearch() {
    const next = query.trim()
    if (next.length === 1) {
      setSearchError(t("peopleAccess.customers.searchTooShort"))
      return
    }

    setSearchError(null)
    setPage(1)
    setAppliedQuery(next)
  }

  const from = total === 0 ? 0 : (page - 1) * DIRECTORY_PAGE_SIZE + 1
  const to = Math.min(page * DIRECTORY_PAGE_SIZE, total)

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-base font-semibold tracking-tight">
          {t("peopleAccess.tabs.customers")}
        </h2>
        <p className="max-w-xl text-sm text-muted-foreground">
          {t("peopleAccess.customers.description")}
        </p>
      </div>

      <PeopleSearchForm
        id="portal-customer-search"
        label={t("peopleAccess.customers.searchLabel")}
        placeholder={t("peopleAccess.customers.searchPlaceholder")}
        actionLabel={t("peopleAccess.customers.searchAction")}
        value={query}
        error={searchError}
        onValueChange={setQuery}
        onSubmit={submitSearch}
      />

      {isLoading ? <PageContentSkeleton rows={4} /> : null}

      {loadError !== null ? (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
        >
          {loadError}
        </div>
      ) : null}

      {!isLoading && loadError === null && customers.length === 0 ? (
        <PeopleEmptyState
          icon={Users}
          title={t(
            appliedQuery.length >= 2
              ? "peopleAccess.customers.emptySearch"
              : "peopleAccess.customers.empty",
          )}
          description={t(
            appliedQuery.length >= 2
              ? "peopleAccess.customers.emptySearchDescription"
              : "peopleAccess.customers.emptyDescription",
          )}
        />
      ) : null}

      {!isLoading && customers.length > 0 ? (
        <ul className="space-y-2">
          {customers.map((customer) => (
            <li
              key={customer.id}
              className="flex flex-col gap-3 rounded-lg border border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 space-y-1">
                <p className="truncate text-sm font-medium">{customer.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {customer.email ?? "—"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("peopleAccess.customers.createdAt")}{" "}
                  {formatCreatedAt(customer.createdAt, i18n.language)}
                </p>
              </div>
              <Badge variant={customer.emailVerified ? "success" : "secondary"}>
                {customer.emailVerified
                  ? t("peopleAccess.customers.verified")
                  : t("peopleAccess.customers.unverified")}
              </Badge>
            </li>
          ))}
        </ul>
      ) : null}

      {!isLoading && loadError === null ? (
        <PeoplePager
          page={page}
          pageSize={DIRECTORY_PAGE_SIZE}
          total={total}
          summary={t("peopleAccess.pagination.summary", { from, to, total })}
          previousLabel={t("peopleAccess.pagination.previous")}
          nextLabel={t("peopleAccess.pagination.next")}
          onPageChange={setPage}
        />
      ) : null}
    </div>
  )
}
