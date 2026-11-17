import "@/features/catalog/components/staffCatalog.css"

import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Loader2, Plus, Search } from "lucide-react"

import { Input } from "@/components/ui/input"
import type { TenantCustomer } from "@/features/users/schemas/userSchemas"
import { listTenantCustomers } from "@/features/users/services/usersService"

/** Searches the customer directory (core.customers.read) and adds a direct grant. */
export function CustomerGrantPicker({
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
      <div className="staff-catalog-search">
        <Search size={20} aria-hidden="true" />
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label={t("catalog.products.access.searchCustomers")}
          placeholder={t("catalog.products.access.searchCustomers")}
          className="min-w-0"
        />
      </div>
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

