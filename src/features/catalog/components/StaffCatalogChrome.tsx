import type { ReactNode } from "react"
import { FileText, Package, Search, ShoppingBag, Tag } from "lucide-react"
import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"

import { PageHeader } from "@/components/layout/PageHeader"
import { EmptyState } from "@/components/ui/empty-state"
import { Input } from "@/components/ui/input"
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
    { key: "orders", path: "/pedidos?aba=pedidos", permission: "catalog.orders.read", icon: ShoppingBag },
    { key: "requests", path: "/pedidos?aba=solicitacoes", permission: "catalog.products.read", icon: FileText },
  ] as const

  return (
    <nav className="staff-catalog-tabs" aria-label={t("nav.catalog")}>
      {tabs.filter((tab) => can(tab.permission)).map(({ key, path, icon: Icon }) => (
        <Link className="touch-target" key={key} to={path} aria-current={active === key ? "page" : undefined}>
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
  return (
    <PageHeader className="staff-catalog-heading" title={title} description={description}
      actions={actions ? <div className="staff-catalog-heading-actions">{actions}</div> : undefined} />
  )
}

export function CatalogSearch({ value, onChange, label, placeholder }: {
  value: string
  onChange: (value: string) => void
  label: string
  placeholder: string
}) {
  return (
    <label className="staff-catalog-search">
      <Search size={20} aria-hidden="true" />
      <Input type="search" aria-label={label} title={label} placeholder={placeholder} className="min-w-0 placeholder:text-ellipsis" value={value}
        onChange={(event) => onChange(event.target.value)} />
    </label>
  )
}

export function CatalogEmptyState({ kind, filtered = false, action }: { kind: CatalogView; filtered?: boolean; action?: ReactNode }) {
  const { t } = useTranslation()
  const Icon = kind === "requests" ? FileText : kind === "orders" ? ShoppingBag : Package
  return (
    <div className="staff-catalog-empty" role="status">
      <EmptyState icon={Icon} className="border-0 p-0" title={t(filtered ? "catalog.staff.noResults" : `catalog.${kind}.empty`)}
        description={t(filtered ? "catalog.staff.adjustFilters" : `catalog.staff.empty.${kind}`)} action={filtered ? undefined : action} />
    </div>
  )
}
