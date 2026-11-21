import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"

import { PLAN_PAGE_PATH } from "@/features/billing/lib/planLimitError"
import { BILLING_PAGE_PATH, BILLING_PERMISSION } from "@/features/billing/lib/subscriptionView"
import { useOptionalPermissions } from "@/features/users/permissions/PermissionContext"

/** Inline "Limite do plano atingido — ver planos"; links to Plano e cobrança when the user may manage billing, else to /precos. */
export function PlanLimitNotice({ className }: { className?: string }) {
  const { t } = useTranslation()
  // Staff who may manage billing go to their plan page; everyone else sees the public prices.
  const permissions = useOptionalPermissions()
  const target = permissions?.can(BILLING_PERMISSION) ? BILLING_PAGE_PATH : PLAN_PAGE_PATH

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
      <Link to={target} className="font-medium underline underline-offset-2">
        {t("billing.planLimit.link")}
      </Link>
    </div>
  )
}
