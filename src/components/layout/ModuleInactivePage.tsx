import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/** Shown when a route belongs to a module the tenant has not activated (not a permission problem). */
export function ModuleInactivePage() {
  const { t } = useTranslation()

  return (
    <div className="mx-auto w-full max-w-lg space-y-2 py-12 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">
        {t("moduleInactive.title")}
      </h1>
      <p className="text-sm text-muted-foreground">
        {t("moduleInactive.description")}
      </p>
      <Link to="/" replace className={cn(buttonVariants({ variant: "outline" }))}>
        {t("moduleInactive.back")}
      </Link>
    </div>
  )
}
