import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react"
import { useTranslation } from "react-i18next"
import { Loader2, Plus, Search, X } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import {
  catalogAuditActionI18nKey,
  type CatalogAuditEntry,
  type CatalogProductVisibility,
  type CustomerGroup,
} from "@/features/catalog/schemas/catalogSchemas"
import {
  getCatalogProductAccess,
  getCatalogProductAccessHistory,
  listCustomerGroups,
  putCatalogProductAccess,
} from "@/features/catalog/services/catalogService"
import { listTenantCustomers } from "@/features/users/services/usersService"
import type { TenantCustomer } from "@/features/users/schemas/userSchemas"

/** Lets the product editor persist access right after the product save. */
export type CatalogProductAccessSectionHandle = {
  /** PUTs the grant list only when it changed; resolves false on failure or when not loaded. */
  persist: () => Promise<boolean>
}

type CatalogProductAccessSectionProps = {
  productId: string
  canManage: boolean
}

function sameSet(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) {
    return false
  }
  const set = new Set(a)
  return b.every((id) => set.has(id))
}

export const CatalogProductAccessSection = forwardRef<
  CatalogProductAccessSectionHandle,
  CatalogProductAccessSectionProps
>(function CatalogProductAccessSection({ productId, canManage }, ref) {
  const { t, i18n } = useTranslation()

  const [visibility, setVisibility] = useState<CatalogProductVisibility>("Public")
  const [groupIds, setGroupIds] = useState<string[]>([])
  const [customerIds, setCustomerIds] = useState<string[]>([])
  const [groups, setGroups] = useState<CustomerGroup[]>([])
  const [customersById, setCustomersById] = useState<Record<string, TenantCustomer>>({})
  const [history, setHistory] = useState<CatalogAuditEntry[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [apiNames, setApiNames] = useState<Record<string, string>>({})
  const [loadFailed, setLoadFailed] = useState(false)
  const [historyFailed, setHistoryFailed] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const loadedRef = useRef(false)
  const baselineRef = useRef<{
    visibility: CatalogProductVisibility
    groupIds: string[]
    customerIds: string[]
  }>({ visibility: "Public", groupIds: [], customerIds: [] })

  const rememberCustomers = useCallback((list: readonly TenantCustomer[]) => {
    if (list.length === 0) {
      return
    }
    setCustomersById((current) => {
      const next = { ...current }
      for (const customer of list) {
        next[customer.id] = customer
      }
      return next
    })
  }, [])

  const reloadHistory = useCallback(() => {
    void getCatalogProductAccessHistory(productId)
      .then((entries) => {
        setHistoryFailed(false)
        setHistory(entries)
      })
      .catch(() => {
        setHistoryFailed(true)
        setHistory([])
      })
  }, [productId])

  useEffect(() => {
    let active = true
    loadedRef.current = false
    void listCustomerGroups()
      .then((list) => {
        if (active) {
          setGroups(list)
        }
      })
      .catch(() => undefined)
    void getCatalogProductAccess(productId)
      .then((access) => {
        if (!active) {
          return
        }
        setVisibility(access.visibility)
        setGroupIds(access.groupIds)
        setCustomerIds(access.customerIds)
        setApiNames(access.customerNames ?? {})
        baselineRef.current = {
          visibility: access.visibility,
          groupIds: access.groupIds,
          customerIds: access.customerIds,
        }
        loadedRef.current = true
        if (access.customerIds.length > 0) {
          void listTenantCustomers({ pageSize: 50 })
            .then((page) => rememberCustomers(page.items))
            .catch(() => undefined)
        }
      })
      .catch(() => {
        if (active) {
          setLoadFailed(true)
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false)
        }
      })
    reloadHistory()
    return () => {
      active = false
    }
  }, [productId, rememberCustomers, reloadHistory, reloadKey])

  const isDirty = useCallback(() => {
    const base = baselineRef.current
    if (base.visibility !== visibility) {
      return true
    }
    if (visibility === "Public") {
      return false
    }
    return !sameSet(base.groupIds, groupIds) || !sameSet(base.customerIds, customerIds)
  }, [visibility, groupIds, customerIds])

  useImperativeHandle(
    ref,
    () => ({
      persist: async () => {
        if (!canManage) {
          return true
        }
        if (!loadedRef.current) {
          return false
        }
        if (!isDirty()) {
          return true
        }
        const payload =
          visibility === "Restricted"
            ? { visibility, customerIds, groupIds }
            : { visibility, customerIds: [], groupIds: [] }
        try {
          const saved = await putCatalogProductAccess(productId, payload)
          setVisibility(saved.visibility)
          setGroupIds(saved.groupIds)
          setCustomerIds(saved.customerIds)
          setApiNames((current) => ({ ...current, ...(saved.customerNames ?? {}) }))
          baselineRef.current = {
            visibility: saved.visibility,
            groupIds: saved.groupIds,
            customerIds: saved.customerIds,
          }
          toast.success(t("catalog.products.access.toastSaved"))
          reloadHistory()
          return true
        } catch (error) {
          toast.error(
            error instanceof Error
              ? error.message
              : t("catalog.customerGroups.errors.saveAccess"),
          )
          return false
        }
      },
    }),
    [canManage, isDirty, visibility, customerIds, groupIds, productId, reloadHistory, t],
  )

  const locked = !canManage || loading || loadFailed
  const missingNames = customerIds.some((id) => !customersById[id] && !apiNames[id])
  const grantCount = groupIds.length + customerIds.length
  const showEmptyWarning = visibility === "Restricted" && grantCount === 0

  function toggleGroup(id: string) {
    setGroupIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    )
  }

  function addCustomer(customer: TenantCustomer) {
    rememberCustomers([customer])
    setCustomerIds((current) =>
      current.includes(customer.id) ? current : [...current, customer.id],
    )
  }

  function removeCustomer(id: string) {
    setCustomerIds((current) => current.filter((item) => item !== id))
  }

  return (
    <section className="space-y-3 rounded-lg border border-border p-3">
      <p className="text-sm font-medium">{t("catalog.products.access.title")}</p>
      {!canManage ? (
        <p className="text-xs text-muted-foreground">
          {t("catalog.products.access.readOnlyHint")}
        </p>
      ) : null}
      {loading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          {t("catalog.staff.loading")}
        </p>
      ) : null}

      {loadFailed ? (
        <div role="alert" className="flex flex-wrap items-center gap-2 rounded-lg border border-destructive/40 p-2 text-sm">
          <span>{t("catalog.products.access.loadError")}</span>
          <Button type="button" variant="outline" size="sm" onClick={() => {
            setLoading(true)
            setLoadFailed(false)
            setReloadKey((k) => k + 1)
          }}>
            {t("catalog.products.access.retry")}
          </Button>
        </div>
      ) : null}
      <fieldset
        className="grid gap-2 sm:grid-cols-2"
        disabled={locked}
        aria-label={t("catalog.products.access.title")}
      >
        {(["Public", "Restricted"] as const).map((option) => (
          <label
            key={option}
            className="flex min-h-11 cursor-pointer items-start gap-2 rounded-lg border border-input p-3 text-sm has-[:checked]:border-primary"
          >
            <input
              type="radio"
              name={`product-visibility-${productId}`}
              className="mt-0.5"
              value={option}
              checked={visibility === option}
              disabled={locked}
              onChange={() => setVisibility(option)}
            />
            <span>
              <span className="block font-medium">
                {t(`catalog.products.access.${option === "Public" ? "public" : "restricted"}`)}
              </span>
              <span className="block text-xs text-muted-foreground">
                {t(
                  `catalog.products.access.${option === "Public" ? "publicHint" : "restrictedHint"}`,
                )}
              </span>
            </span>
          </label>
        ))}
      </fieldset>

      {visibility === "Restricted" && !loadFailed ? (
        <div className="space-y-3">
          {showEmptyWarning ? (
            <p
              role="alert"
              className="rounded-lg bg-warning/10 p-2 text-sm text-warning-foreground"
            >
              {t("catalog.products.access.emptyWarning")}
            </p>
          ) : null}

          <div className="space-y-2">
            <p className="text-sm font-medium">
              {t("catalog.products.access.groups")}
            </p>
            {groups.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("catalog.products.access.noGroups")}
              </p>
            ) : (
              <ul className="max-h-40 space-y-1 overflow-y-auto">
                {groups.map((group) => (
                  <li key={group.id}>
                    <label className="flex min-h-11 items-center gap-2 text-sm">
                      <Checkbox
                        checked={groupIds.includes(group.id)}
                        disabled={locked}
                        onChange={() => toggleGroup(group.id)}
                      />
                      {group.name}
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">
              {t("catalog.products.access.customers")}
            </p>
            {customerIds.length > 0 ? (
              <ul className="flex flex-wrap gap-2">
                {customerIds.map((id) => (
                  <li key={id}>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={locked}
                      onClick={() => removeCustomer(id)}
                    >
                      {customersById[id]?.name ?? apiNames[id] ??
                        t("catalog.customerGroups.members.unknown")}
                      <X size={14} aria-hidden="true" />
                    </Button>
                  </li>
                ))}
              </ul>
            ) : null}
            {missingNames ? (
              <p className="text-xs text-muted-foreground">{t("catalog.products.access.namesUnavailable")}</p>
            ) : null}
            {!locked ? (
              <CustomerGrantPicker excludeIds={customerIds} onAdd={addCustomer} />
            ) : null}
          </div>
        </div>
      ) : null}

      <AccessHistory entries={history} failed={historyFailed} locale={i18n.language} />
    </section>
  )
})

function CustomerGrantPicker({
  excludeIds,
  onAdd,
}: {
  excludeIds: string[]
  onAdd: (customer: TenantCustomer) => void
}) {
  const { t } = useTranslation()
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<TenantCustomer[]>([])
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    const term = query.trim()
    if (term.length === 0) {
      return
    }
    let active = true
    const timer = setTimeout(() => {
      setSearching(true)
      void listTenantCustomers({ q: term, pageSize: 20 })
        .then((page) => {
          if (active) {
            setResults(page.items)
          }
        })
        .catch(() => {
          if (active) {
            setResults([])
          }
        })
        .finally(() => {
          if (active) {
            setSearching(false)
          }
        })
    }, 250)
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [query])

  const excluded = new Set(excludeIds)
  const visible = (query.trim().length === 0 ? [] : results).filter((customer) => !excluded.has(customer.id))

  return (
    <div className="space-y-2 rounded-lg border border-border p-3">
      <label className="staff-catalog-search">
        <Search size={20} aria-hidden="true" />
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label={t("catalog.products.access.searchCustomers")}
          placeholder={t("catalog.products.access.searchCustomers")}
          className="min-w-0"
        />
      </label>
      {searching ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          {t("catalog.staff.loading")}
        </p>
      ) : query.trim().length > 0 && visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t("catalog.products.access.noCustomers")}
        </p>
      ) : (
        <ul className="max-h-40 divide-y divide-border overflow-y-auto">
          {visible.map((customer) => (
            <li key={customer.id}>
              <button
                type="button"
                className="touch-target flex w-full items-center justify-between gap-2 py-2 text-left text-sm"
                onClick={() => onAdd(customer)}
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">{customer.name}</span>
                  {customer.email ? (
                    <span className="block truncate text-muted-foreground">
                      {customer.email}
                    </span>
                  ) : null}
                </span>
                <Plus size={16} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function AccessHistory({
  entries,
  failed,
  locale,
}: {
  entries: CatalogAuditEntry[] | null
  failed: boolean
  locale: string
}) {
  const { t } = useTranslation()
  if (entries === null) {
    return null
  }
  if (failed) {
    return (
      <div className="space-y-1">
        <p className="text-sm font-medium">{t("catalog.products.access.history.title")}</p>
        <p role="alert" className="text-sm text-destructive">{t("catalog.products.access.history.loadError")}</p>
      </div>
    )
  }
  if (entries.length === 0) {
    return (
      <div className="space-y-1">
        <p className="text-sm font-medium">
          {t("catalog.products.access.history.title")}
        </p>
        <p className="text-sm text-muted-foreground">
          {t("catalog.products.access.history.empty")}
        </p>
      </div>
    )
  }
  const dateFormat = new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">
        {t("catalog.products.access.history.title")}
      </p>
      <ul className="space-y-2 text-sm">
        {entries.map((entry) => {
          const actor = entry.actorName
            ? `${t("catalog.products.access.history.actorTeam")} · ${entry.actorName}`
            : t("catalog.products.access.history.actorTeam")
          return (
            <li key={entry.id} className="border-b border-border pb-2 last:border-0">
              <span className="font-medium">{actor}</span>{" "}
              {t(catalogAuditActionI18nKey(entry.action))}
              <span className="block text-xs text-muted-foreground">
                {dateFormat.format(new Date(entry.createdAt))}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
