import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"

import { missingStepCount } from "@/features/rentals/lib/firstSteps"
import { getSetupStatus } from "@/features/rentals/services/setupStatusService"

/** "Primeiros passos" entry on Início, with how many steps are still open once the status loads. */
export function FirstStepsLink() {
  const { t } = useTranslation()
  const [remaining, setRemaining] = useState<number | null>(null)

  useEffect(() => {
    let active = true
    void getSetupStatus()
      .then((status) => { if (active) setRemaining(missingStepCount(status)) })
      .catch(() => { if (active) setRemaining(null) })
    return () => { active = false }
  }, [])

  return (
    <p className="flex flex-wrap items-center gap-x-3 text-sm">
      <Link className="inline-flex min-h-11 items-center font-medium text-primary underline-offset-4 hover:underline" to="/primeiros-passos">
        {t("assistant.firstSteps.title")}
      </Link>
      {remaining !== null && remaining > 0 ? (
        <span className="text-muted-foreground">{t("assistant.firstSteps.remaining", { count: remaining })}</span>
      ) : null}
    </p>
  )
}
