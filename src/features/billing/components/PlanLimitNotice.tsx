import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"

import { PLAN_PAGE_PATH } from "@/features/billing/lib/planLimitError"

/** Inline "Limite do plano atingido — ver planos" with a link to the plans page. */
export function PlanLimitNotice({ className }: { className?: string }) {
  const { t } = useTranslation()

  return (
    <div
      role="alert"
      className={
        className ??
        "rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm"
      }
    >
      <span>{t("billing.planLimit.title")}</span>
      {" — "}
      <Link to={PLAN_PAGE_PATH} className="font-medium underline underline-offset-2">
        {t("billing.planLimit.link")}
      </Link>
    </div>
  )
}
