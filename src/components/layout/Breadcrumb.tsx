import { useContext, useSyncExternalStore, type ReactNode } from "react"
import { Link, useLocation } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { ArrowLeft, ChevronRight } from "lucide-react"

import { getPageTitleKey, useAppNavigationSections } from "./navigation"
import { matchNavigationPath } from "./navigationMatching"
import { matchModuleIntro, moduleIntroPath } from "./navigationIntros"
import { BreadcrumbTitleContext } from "./useBreadcrumbTitle"
import { ICON_STROKE_WIDTH } from "@/lib/icon"

const createTitleKey: Record<string, string> = {
  "/ativos/novo": "nav.createEquipment",
  "/ativos/tipos/novo": "assets.resourceTypes.new",
  "/catalogo/grupos/novo": "catalog.customerGroups.createTitle",
  "/catalogo/produtos/novo": "catalog.products.createTitle",
  "/configuracoes/recursos/novo": "nav.createResource",
  "/os/nova": "workOrders.create.title",
  "/pessoas-e-acesso/funcoes/nova": "peopleAccess.roles.createTitle",
  "/pmoc/novo": "nav.pmocNew",
}

const narrowQuery = "(max-width: 639px)"
function subscribeToViewport(onChange: () => void) {
  const media = window.matchMedia?.(narrowQuery)
  media?.addEventListener("change", onChange)
  return () => media?.removeEventListener("change", onChange)
}
function isNarrowViewport() {
  return window.matchMedia?.(narrowQuery).matches ?? false
}

type BreadcrumbProps = {
  /** Top-bar styling: no bottom margin, "/" separators. */
  variant?: "page" | "header"
  /** Rendered when there is no breadcrumb to show (fewer than two crumbs). */
  fallback?: ReactNode
}

export function Breadcrumb({ variant = "page", fallback = null }: BreadcrumbProps = {}) {
  const inHeader = variant === "header"
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const { sections } = useAppNavigationSections("module-intros")
  const { sections: shellSections } = useAppNavigationSections("shell")
  const { title } = useContext(BreadcrumbTitleContext)
  const narrow = useSyncExternalStore(subscribeToViewport, isNarrowViewport, () => false)
  const match = matchNavigationPath(sections.flatMap((section) => section.items), pathname)
  const crumbs: { label: string; to?: string }[] = []
  const intro = matchModuleIntro(sections, pathname)

  const normalized = pathname.replace(/\/+$/, "") || "/"
  if (/^\/(?:catalogo\/produtos|configuracoes\/recursos)\/(?:[^/]+\/)?cadastro$/.test(normalized)) return <>{fallback}</>
  if (/^\/grupos\/[^/]+$/.test(normalized)) return <>{fallback}</>

  const maintenanceChild = pathname.startsWith("/manutencao/")
  const pedidosChild = pathname.startsWith("/pedidos/")
  if (maintenanceChild) {
    crumbs.push({ label: t("nav.manutencao"), to: "/manutencao" })
    crumbs.push({ label: t(pathname === "/manutencao/planos/novo" ? "maintenance.newPlan" : "maintenance.newOrder") })
  } else if (pedidosChild) {
    crumbs.push({ label: t("nav.pedidos"), to: "/pedidos" })
    crumbs.push({ label: title?.pathname === pathname ? title.value : t("nav.details") })
  } else if (intro) {
    crumbs.push({ label: t(intro.titleKey), to: moduleIntroPath(intro.key) })
    crumbs.push({ label: t("moduleIntro.title") })
  } else if (match) {
    const { item, child, tab, isDetail } = match
    crumbs.push({ label: t(item.labelKey), to: child ? undefined : item.to })
    if (child) crumbs.push({ label: t(child.labelKey), to: child.to })
    if (tab && crumbs.at(-1)?.label !== t(tab.labelKey)) {
      crumbs.push({ label: t(tab.labelKey), to: tab.to })
    }
    const path = pathname.replace(/\/+$/, "")
    const createKey = createTitleKey[path]
    if (createKey && !isDetail && crumbs.length > 0) {
      crumbs[crumbs.length - 1] = { label: t(createKey) }
    }
    if (isDetail) {
      crumbs.push({
        label: createKey
          ? t(createKey)
          : title?.pathname === pathname ? title.value : t("nav.details"),
      })
    }
  } else {
    crumbs.push({ label: t(getPageTitleKey(pathname)) })
  }

  // Header only: the module-intro sections above do not know child routes such as
  // /agendas or the settings pages, so complete the trail from the shell navigation.
  if (inHeader && crumbs.length < 2) {
    const shellMatch = matchNavigationPath(shellSections.flatMap((section) => section.items), pathname)
    if (shellMatch && !shellMatch.isDetail) {
      const { item, child, tab } = shellMatch
      const section = shellSections.find((candidate) => candidate.items.includes(item))
      const current = t((tab ?? child ?? item).labelKey)
      if (child) {
        crumbs.splice(0, crumbs.length, { label: t(item.labelKey), to: undefined }, { label: current })
      } else if (section && !section.standalone) {
        const sectionLabel = t(section.titleKey)
        if (sectionLabel !== current) {
          crumbs.splice(0, crumbs.length, { label: sectionLabel }, { label: current })
        }
      }
    }
  }

  const visibleCrumbs = narrow ? crumbs.slice(-2) : crumbs
  if (visibleCrumbs.length < 2) return <>{fallback}</>
  return (
    <nav aria-label={t("nav.breadcrumbLabel")} className={inHeader ? "min-w-0 text-sm text-muted-foreground" : pedidosChild || maintenanceChild ? "mx-auto mb-4 max-w-[1240px] text-sm text-muted-foreground" : "mb-4 text-sm text-muted-foreground"}>
      <ol className="flex min-w-0 items-center gap-2">
        {visibleCrumbs.map((crumb, index) => {
          const current = index === visibleCrumbs.length - 1
          return (
            <li key={`${index}-${crumb.label}`} className="flex min-w-0 items-center gap-2">
              {index > 0 && (inHeader || pedidosChild || maintenanceChild ? <span aria-hidden="true">/</span> : <ChevronRight className="size-4 shrink-0" strokeWidth={ICON_STROKE_WIDTH} aria-hidden="true" />)}
              {current ? (
                <span aria-current="page" className="truncate font-medium text-foreground">{crumb.label}</span>
              ) : crumb.to ? (
                <Link
                  to={crumb.to}
                  aria-label={narrow ? t("nav.backTo", { page: crumb.label }) : undefined}
                  className="inline-flex min-h-[44px] -my-3 min-w-0 items-center gap-1 rounded-sm hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {narrow && <ArrowLeft className="size-4 shrink-0" strokeWidth={ICON_STROKE_WIDTH} aria-hidden="true" />}
                  <span className="truncate">{crumb.label}</span>
                </Link>
              ) : <span className="truncate">{crumb.label}</span>}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
