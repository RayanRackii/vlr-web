import type { ReactNode } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"

import { AccessDeniedPage } from "@/components/layout/AccessDeniedPage"
import { filterNavigationTabs, type NavigationTab } from "@/components/layout/navigationTabs"
import { RouteTabsContext } from "@/components/layout/RouteTabsContext"
import { PageContentSkeleton } from "@/components/loading/PageContentSkeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { usePermissions } from "@/features/users/permissions/PermissionContext"

type FeatureRouteTabsProps = {
  labelKey: string
  tabs: readonly NavigationTab[]
  content: Readonly<Record<string, ReactNode>>
  /** Feature header (its own `PageHeader`), rendered above the tabs as the page h1. */
  header?: ReactNode
}

/** Existing URLs select tabs; each route keeps its original permission guard. */
export function FeatureRouteTabs({ labelKey, tabs, content, header }: FeatureRouteTabsProps) {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const tabPath = pathname.replace(/\/+$/, "") || "/"
  const navigate = useNavigate()
  const { activeModules, permissions, isLoading } = usePermissions()
  const visible = filterNavigationTabs(tabs, activeModules, permissions)

  if (isLoading) return <PageContentSkeleton />
  if (!visible.some((tab) => tab.to === tabPath)) return <AccessDeniedPage />

  return (
    <div className="space-y-4">
      {/* The feature header is the page's only h1; it sits outside the route-tabs context. */}
      {header}
      <RouteTabsContext.Provider value>
        <Tabs value={tabPath} onValueChange={(value) => {
          const tab = visible.find((candidate) => candidate.to === value)
          void navigate(`${String(value)}${tab?.search ?? ""}`)
        }} className="space-y-4">
          <TabsList variant="line" aria-label={t(labelKey)}>
            {visible.map((tab) => (
              <TabsTrigger key={tab.to} value={tab.to}>
                {t(tab.labelKey)}
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value={tabPath}>{content[tabPath]}</TabsContent>
        </Tabs>
      </RouteTabsContext.Provider>
    </div>
  )
}
