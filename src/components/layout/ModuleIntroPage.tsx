import { Link, useParams } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { LayoutGrid } from "lucide-react"

import { AuthenticatedNotFoundPage } from "./AuthenticatedNotFoundPage"
import { useAppNavigationSections } from "./navigation"
import { availableModuleIntros, moduleIntroPath, moduleIntroShortcuts } from "./navigationIntros"
import { moduleGuideConfigs } from "@/features/module-guide/configs"
import { ModuleGuide } from "@/features/module-guide/ModuleGuide"
import { PageContentSkeleton } from "@/components/loading/PageContentSkeleton"
import { usePermissions } from "@/features/users/permissions/PermissionContext"

const linkClassName = "flex min-h-11 items-center rounded-lg border border-border px-4 py-3 text-sm font-medium text-primary transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"

export function ModuleIntroPage() {
  const { t } = useTranslation()
  const { moduleKey } = useParams<{ moduleKey: string }>()
  const { sections, isLoading } = useAppNavigationSections()
  const { currentUser } = usePermissions()
  const intros = availableModuleIntros(sections)
  const intro = intros.find((entry) => entry.key === moduleKey)

  if (isLoading) return <PageContentSkeleton rows={3} />
  if (!intro) return <AuthenticatedNotFoundPage />

  const shortcuts = moduleIntroShortcuts(intro.items)
  const related = intros.filter((entry) => intro.relatedModuleKeys.includes(entry.key))
  const icon = intro.items[0]?.icon ?? LayoutGrid

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-8">
      <ModuleGuide
        config={moduleGuideConfigs[intro.key]}
        titleKey={intro.titleKey}
        summaryKey={intro.summaryKey}
        icon={icon}
        shortcuts={shortcuts}
        related={related.map((entry) => ({ to: moduleIntroPath(entry.key), labelKey: entry.titleKey }))}
        userId={currentUser?.id ?? null}
        tenantId={currentUser?.tenantId ?? null}
      />
      <section aria-labelledby="module-shortcuts" className="space-y-3">
        <h2 id="module-shortcuts" className="text-base font-semibold">{t("moduleIntro.shortcuts")}</h2>
        <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shortcuts.map((shortcut) => (
            <Link key={shortcut.to} to={shortcut.to} className={linkClassName}>{t(shortcut.labelKey)}</Link>
          ))}
        </div>
      </section>
      {related.length > 0 && (
        <section aria-labelledby="module-related" className="space-y-3">
          <h2 id="module-related" className="text-base font-semibold">{t("moduleIntro.relatedModules")}</h2>
          <div className="grid min-w-0 gap-3 sm:grid-cols-2">
            {related.map((entry) => (
              <Link key={entry.key} to={moduleIntroPath(entry.key)} className={linkClassName}>{t(entry.titleKey)}</Link>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
