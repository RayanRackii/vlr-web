import { useContext, useSyncExternalStore } from "react"
import { Link, useLocation } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { ArrowLeft, ChevronRight } from "lucide-react"

import { getPageTitleKey, useAppNavigationSections } from "./navigation"
import { matchNavigationPath } from "./navigationMatching"
import { matchModuleIntro, moduleIntroPath } from "./navigationIntros"
import { BreadcrumbTitleContext } from "./useBreadcrumbTitle"
import { ICON_STROKE_WIDTH } from "@/lib/icon"

const narrowQuery = "(max-width: 639px)"
function subscribeToViewport(onChange: () => void) {
  const media = window.matchMedia?.(narrowQuery)
  media?.addEventListener("change", onChange)
  return () => media?.removeEventListener("change", onChange)
}
function isNarrowViewport() {
  return window.matchMedia?.(narrowQuery).matches ?? false
}

export function Breadcrumb() {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const { sections } = useAppNavigationSections()
  const { title } = useContext(BreadcrumbTitleContext)
  const narrow = useSyncExternalStore(subscribeToViewport, isNarrowViewport, () => false)
  const match = matchNavigationPath(sections.flatMap((section) => section.items), pathname)
  const crumbs: { label: string; to?: string }[] = []
  const intro = matchModuleIntro(sections, pathname)

  if (intro) {
    crumbs.push({ label: t(intro.titleKey), to: moduleIntroPath(intro.key) })
    crumbs.push({ label: t("moduleIntro.title") })
  } else if (match) {
    const { item, child, tab, isDetail } = match
    crumbs.push({ label: t(item.labelKey), to: child ? undefined : item.to })
    if (child) crumbs.push({ label: t(child.labelKey), to: child.to })
    if (tab && crumbs.at(-1)?.label !== t(tab.labelKey)) {
      crumbs.push({ label: t(tab.labelKey), to: tab.to })
    }
    if (isDetail) {
      crumbs.push({ label: title?.pathname === pathname ? title.value : t("nav.details") })
    }
  } else {
    crumbs.push({ label: t(getPageTitleKey(pathname)) })
  }

  const visibleCrumbs = narrow ? crumbs.slice(-2) : crumbs
  return (
    <nav aria-label={t("nav.breadcrumbLabel")} className="mb-4 text-sm text-muted-foreground">
      <ol className="flex min-w-0 items-center gap-2">
        {visibleCrumbs.map((crumb, index) => {
          const current = index === visibleCrumbs.length - 1
          return (
            <li key={`${index}-${crumb.label}`} className="flex min-w-0 items-center gap-2">
              {index > 0 && <ChevronRight className="size-4 shrink-0" strokeWidth={ICON_STROKE_WIDTH} aria-hidden="true" />}
              {current ? (
                <span aria-current="page" className="truncate font-medium text-foreground">{crumb.label}</span>
              ) : crumb.to ? (
                <Link
                  to={crumb.to}
                  aria-label={narrow ? t("nav.backTo", { page: crumb.label }) : undefined}
                  className="inline-flex min-w-0 items-center gap-1 rounded-sm hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
