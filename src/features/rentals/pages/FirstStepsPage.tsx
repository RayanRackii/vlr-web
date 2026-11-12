import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"

import { PageHeader } from "@/components/layout/PageHeader"
import { Button } from "@/components/ui/button"
import {
  getSetupStatus,
  type SetupStatus,
} from "@/features/rentals/services/setupStatusService"

const checklistKeys = ["company", "pricedOffer", "hours", "resource", "admin", "previewItem"] as const

const continueHref: Partial<Record<(typeof checklistKeys)[number], string>> = {
  hours: "/configuracoes/agenda",
  resource: "/configuracoes/recursos",
  pricedOffer: "/catalogo/produtos",
  company: "/configuracoes",
}

export function FirstStepsPage() {
  const { t } = useTranslation()
  const [status, setStatus] = useState<SetupStatus | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let active = true
    void getSetupStatus().then((next) => {
      if (active) setStatus(next)
    }).catch(() => {
      if (active) setError(true)
    })
    return () => {
      active = false
    }
  }, [])

  const byKey = new Map(status?.checklist.map((item) => [item.key, item.state]) ?? [])

  return (
    <div className="mx-auto w-full min-w-0 max-w-3xl space-y-6">
      <PageHeader title={t("assistant.firstSteps.title")} description={t("assistant.firstSteps.description")} />
      {error ? <p role="alert" className="text-sm text-destructive">{t("assets.inventory.errors.loadFailed")}</p> : null}
      <section className="space-y-3 rounded-xl border border-border bg-card p-4" aria-label={t("assistant.firstSteps.title")}>
        {checklistKeys.map((key) => {
          const apiKey = key === "previewItem" ? "preview" : key
          const state = byKey.get(apiKey) ?? "missing"
          const href = continueHref[key]
          return (
            <div key={key} className="flex flex-col gap-3 border-b border-border py-3 last:border-b-0 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-sm font-medium">{t(`assistant.firstSteps.${key}`)}</h2>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{t(`assistant.firstSteps.state.${state}`)}</span>
                </div>
                <p className="text-sm text-muted-foreground">{t(`assistant.firstSteps.detail.${key}`)}</p>
              </div>
              {href && state !== "published" ? (
                <Button nativeButton={false} variant="outline" className="min-h-11" render={<Link to={href} />}>
                  {t("cadastro.next")}
                </Button>
              ) : null}
            </div>
          )
        })}
      </section>
    </div>
  )
}
