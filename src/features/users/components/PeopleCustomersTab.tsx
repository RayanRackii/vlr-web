import { useCallback, useEffect, useRef, useState } from "react"
import { Link } from "react-router-dom"
import { Users } from "lucide-react"
import { useTranslation } from "react-i18next"

import { DataList, type DataListColumn } from "@/components/data-table/DataList"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { EmptyStateProps } from "@/components/ui/empty-state"
import { useModuleIntroLink } from "@/hooks/useModuleIntroLink"
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
  const learnMore = useModuleIntroLink("peoplePortal")
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

  const empty: EmptyStateProps = {
    icon: Users,
    example: appliedQuery ? undefined : t("emptyStates.examples.customers"),
    learnMore: appliedQuery ? undefined : learnMore,
    action: appliedQuery ? <Button onClick={() => { setQuery(""); setAppliedQuery(""); setSearchError(null); setPage(1) }}>{t("emptyStates.clearSearch")}</Button> : undefined,
    title: t(appliedQuery.length >= 2 ? "peopleAccess.customers.emptySearch" : "peopleAccess.customers.empty"),
    description: t(appliedQuery.length >= 2 ? "peopleAccess.customers.emptySearchDescription" : "peopleAccess.customers.emptyDescription"),
  }

  function identity(customer: TenantCustomer) {
    return (
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-xs font-semibold uppercase text-accent-foreground" aria-hidden>{customer.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("")}</span>
        <div className="min-w-0">
          <Link className="inline-flex min-h-11 items-center break-words font-semibold underline-offset-4 hover:underline" to={`/pessoas-e-acesso/clientes/${customer.id}`}>
            {customer.name}
          </Link>
          <p className="break-words text-sm text-muted-foreground">{customer.email ?? "—"}</p>
        </div>
      </div>
    )
  }

  function statusBadge(customer: TenantCustomer) {
    return (
      <Badge className="h-auto min-h-6 gap-1.5 px-2.5 py-0.5 text-xs font-semibold" variant={customer.emailVerified ? "success" : "warning"}>
        <span className="inline-block size-1.5 shrink-0 rounded-full bg-current" aria-hidden />
        {t(customer.emailVerified ? "peopleAccess.customers.verified" : "peopleAccess.customers.unverified")}
      </Badge>
    )
  }

  const columns: DataListColumn<TenantCustomer>[] = [
    { id: "name", header: t("peopleAccess.users.fullName"), cell: identity },
    {
      id: "createdAt",
      header: t("peopleAccess.customers.createdAt"),
      className: "text-sm tabular-nums text-muted-foreground",
      cell: (customer) => formatCreatedAt(customer.createdAt, i18n.language),
    },
    { id: "status", header: t("peopleAccess.columns.status"), cell: statusBadge },
  ]

  return (
    <div className="space-y-6">
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

      <DataList<TenantCustomer>
        {...(loadError !== null
          ? { state: "error" as const, error: loadError, onRetry: () => { void loadCustomers() } }
          : { state: isLoading ? ("loading" as const) : ("ready" as const) })}
        label={t("peopleAccess.tabs.customers")}
        columns={columns}
        rows={customers}
        getRowId={(customer) => customer.id}
        heading={
          <>
            <h2 className="font-semibold text-foreground">{t("peopleAccess.customers.customerCount", { count: total })}</h2>
            <p className="hidden sm:block">{t("peopleAccess.customers.description")}</p>
          </>
        }
        empty={empty}
        renderCard={(customer) => (
          <>
            <div className="flex items-start justify-between gap-3">
              {identity(customer)}
              {statusBadge(customer)}
            </div>
            <small className="text-muted-foreground">
              {t("peopleAccess.customers.createdAt")} {formatCreatedAt(customer.createdAt, i18n.language)}
            </small>
          </>
        )}
      />

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
