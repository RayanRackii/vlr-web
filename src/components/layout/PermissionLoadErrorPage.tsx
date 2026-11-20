import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { usePermissions } from "@/features/users/permissions/PermissionContext"

/** Shown instead of "access denied" when the profile (`/me`) could not be loaded. */
export function PermissionLoadErrorPage() {
  const { t } = useTranslation()
  const { refresh } = usePermissions()

  return (
    <div role="alert" className="mx-auto w-full max-w-lg space-y-2 py-12 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">
        {t("permissionLoadError.title")}
      </h1>
      <p className="text-sm text-muted-foreground">
        {t("permissionLoadError.description")}
      </p>
      <Button type="button" variant="outline" onClick={() => void refresh()}>
        {t("permissionLoadError.retry")}
      </Button>
    </div>
  )
}
