import type { ReactNode } from "react"
import { ChevronDown, FileText, Package, Search, ShoppingBag, Tag } from "lucide-react"
import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import type { Column } from "@tanstack/react-table"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { usePermissions } from "@/features/users/permissions/PermissionContext"
import "./staffCatalog.css"

type CatalogView = "products" | "orders" | "requests"

export function CatalogTabs({ active, counts = {} }: {
  active: CatalogView
  counts?: Partial<Record<CatalogView, number>>
}) {
  const { t } = useTranslation()
  const { can } = usePermissions()
  const tabs = [
    { key: "products", path: "/catalogo/produtos", permission: "catalog.products.read", icon: Tag },
    { key: "orders", path: "/catalogo/pedidos", permission: "catalog.orders.read", icon: ShoppingBag },
    { key: "requests", path: "/catalogo/solicitacoes", permission: "catalog.products.read", icon: FileText },
  ] as const

  return (
    <nav className="staff-catalog-tabs" aria-label={t("nav.catalog")}>
      {tabs.filter((tab) => can(tab.permission)).map(({ key, path, icon: Icon }) => (
        <Link key={key} to={path} aria-current={active === key ? "page" : undefined}>
          <Icon size={20} aria-hidden="true" />
          {key === "requests" ? <>
            <span className="staff-catalog-tab-long">{t("catalog.requests.title")}</span>
            <span className="staff-catalog-tab-short">{t("nav.catalogRequests")}</span>
          </> : t(`catalog.${key}.title`)}
          {counts[key] !== undefined ? <span className="staff-catalog-tab-count">{counts[key]}</span> : null}
        </Link>
      ))}
    </nav>
  )
}

export function CatalogHeading({ title, description, actions }: {
  title: string
  description: string
  actions?: ReactNode
}) {
  const { t } = useTranslation()
  return (
    <header className="staff-catalog-heading">
      <div>
        <p className="staff-catalog-eyebrow">{t("nav.catalog")}</p>
        <h1>{title}</h1>
        <p className="staff-catalog-subtitle">{description}</p>
      </div>
      {actions ? <div className="staff-catalog-heading-actions">{actions}</div> : null}
    </header>
  )
}

export function CatalogSearch({ value, onChange, label }: {
  value: string
  onChange: (value: string) => void
  label: string
}) {
  return (
    <label className="staff-catalog-search">
      <Search size={20} aria-hidden="true" />
      <Input type="search" aria-label={label} placeholder={label} value={value}
        onChange={(event) => onChange(event.target.value)} />
    </label>
  )
}

export function CatalogColumnFilter<T>({ column, title, options }: {
  column: Column<T>
  title: string
  options?: readonly { value: string; label: string }[]
}) {
  const { t } = useTranslation()
  const value = column.getFilterValue()
  return (
    <Popover>
      <PopoverTrigger render={<Button variant="outline" className="staff-catalog-filter touch-target" data-active={column.getIsFiltered()} />}>
        {title}<ChevronDown size={16} aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent className="w-64" align="start">
        <label className="grid gap-2 text-sm font-medium">
          {title}
          {options ? <select className="min-h-11 w-full rounded-lg border border-input bg-background px-3"
            value={typeof value === "string" ? value : ""} onChange={(event) => column.setFilterValue(event.target.value)}>
            <option value="">{t("catalog.staff.allStatuses")}</option>
            {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select> : <Input className="min-h-11" autoComplete="off" placeholder={t("common.searchPlaceholder")}
            value={typeof value === "string" ? value : ""}
            onChange={(event) => column.setFilterValue(event.target.value)} />}
        </label>
      </PopoverContent>
    </Popover>
  )
}

export function CatalogEmptyState({ kind, filtered = false }: { kind: CatalogView; filtered?: boolean }) {
  const { t } = useTranslation()
  const Icon = kind === "requests" ? FileText : kind === "orders" ? ShoppingBag : Package
  return (
    <div className="staff-catalog-empty" role="status">
      <span className="staff-catalog-empty-icon"><Icon size={24} aria-hidden="true" /></span>
      <h2>{t(filtered ? "catalog.staff.noResults" : `catalog.${kind}.empty`)}</h2>
      <p>{t(filtered ? "catalog.staff.adjustFilters" : `catalog.staff.empty.${kind}`)}</p>
    </div>
  )
}
