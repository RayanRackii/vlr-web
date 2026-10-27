import { Link, useParams } from "react-router-dom"
import { useTranslation } from "react-i18next"

import { AuthenticatedNotFoundPage } from "./AuthenticatedNotFoundPage"
import { useAppNavigationSections } from "./navigation"
import { availableModuleIntros, moduleIntroPath, moduleIntroShortcuts } from "./navigationIntros"
import { PageContentSkeleton } from "@/components/loading/PageContentSkeleton"
import { Card, CardContent } from "@/components/ui/card"

const linkClassName = "flex min-h-11 items-center rounded-lg border border-border px-4 py-3 text-sm font-medium text-primary transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"

export function ModuleIntroPage() {
  const { t } = useTranslation()
  const { moduleKey } = useParams<{ moduleKey: string }>()
  const { sections, isLoading } = useAppNavigationSections()
  const intros = availableModuleIntros(sections)
  const intro = intros.find((entry) => entry.key === moduleKey)

  if (isLoading) return <PageContentSkeleton rows={3} />
  if (!intro) return <AuthenticatedNotFoundPage />

  const shortcuts = moduleIntroShortcuts(intro.items)
  const related = intros.filter((entry) => intro.relatedModuleKeys.includes(entry.key))

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">{t(intro.titleKey)}</h1>
        <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">{t(intro.summaryKey)}</p>
      </header>
      <Card>
        <CardContent>
          <section aria-labelledby="module-how" className="space-y-3">
            <h2 id="module-how" className="text-base font-semibold">{t("moduleIntro.howItWorks")}</h2>
            <ol className="list-decimal space-y-3 pl-5 text-sm leading-relaxed text-muted-foreground">
              {intro.howItWorksKeys.map((key) => <li key={key}>{t(key)}</li>)}
            </ol>
          </section>
        </CardContent>
      </Card>
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
