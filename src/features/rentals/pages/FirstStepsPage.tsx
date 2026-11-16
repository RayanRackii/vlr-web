import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"

import { PageHeader } from "@/components/layout/PageHeader"
import { ChevronRight } from "lucide-react"

import { FIRST_STEP_HREF, FIRST_STEP_KEYS } from "@/features/rentals/lib/firstSteps"
import {
  getSetupStatus,
  type SetupStatus,
} from "@/features/rentals/services/setupStatusService"

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
      {status === null && !error ? <p role="status">{t("common.loading")}</p> : null}
      {status ? <section className="space-y-3 rounded-xl border border-border bg-card p-4" aria-label={t("assistant.firstSteps.title")}>
        {FIRST_STEP_KEYS.map((key) => {
          const apiKey = key === "previewItem" ? "preview" : key
          const state = byKey.get(apiKey) ?? "missing"
          const href = FIRST_STEP_HREF[key]
          const content = (
            <>
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-sm font-medium">{t(`assistant.firstSteps.${key}`)}</h2>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{t(`assistant.firstSteps.state.${state}`)}</span>
                </div>
                <p className="text-sm text-muted-foreground">{t(`assistant.firstSteps.detail.${key}`)}</p>
              </div>
              {href ? <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" /> : null}
            </>
          )
          const rowClass = "flex items-start justify-between gap-3 border-b border-border py-3 last:border-b-0"
          return href ? (
            <Link key={key} to={href} className={`${rowClass} min-h-11 rounded-md hover:bg-muted/50`}>{content}</Link>
          ) : (
            <div key={key} className={rowClass}>{content}</div>
          )
        })}
      </section> : null}
    </div>
  )
}
