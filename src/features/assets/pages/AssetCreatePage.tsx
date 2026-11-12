import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"

import { AssetWizard } from "@/features/assets/components/AssetWizard"
import type { AssetCategory } from "@/features/assets/schemas/assetCategorySchemas"
import type { AssetFamily } from "@/features/assets/schemas/assetFamilySchemas"
import type { Unit } from "@/features/assets/schemas/unitSchemas"
import { getCategories } from "@/features/assets/services/assetCategoriesService"
import { listActiveAssetFamilies } from "@/features/assets/services/assetFamiliesService"
import { getUnits } from "@/features/assets/services/unitsService"
import { useTrialStatus } from "@/features/users/hooks/useTrialStatus"
import { usePermissions } from "@/features/users/permissions/PermissionContext"
import { describeApiError } from "@/features/users/permissions/rbacErrors"

export function AssetCreatePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { can } = usePermissions()
  const { isTrialReadOnly } = useTrialStatus()
  const [units, setUnits] = useState<Unit[]>([])
  const [categories, setCategories] = useState<AssetCategory[]>([])
  const [families, setFamilies] = useState<AssetFamily[]>([])
  const [ready, setReady] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const readOnly = isTrialReadOnly || !can("inventory.assets.write")

  useEffect(() => {
    let active = true
    void Promise.all([getUnits(), getCategories(), listActiveAssetFamilies()]).then(([nextUnits, nextCategories, nextFamilies]) => {
      if (!active) return
      setUnits(nextUnits)
      setCategories(nextCategories)
      setFamilies(nextFamilies)
      setReady(true)
    }).catch((error: unknown) => {
      if (!active) return
      setLoadError(describeApiError(error, t("assets.inventory.errors.loadFailed")))
      setReady(true)
    })
    return () => {
      active = false
    }
  }, [t])

  if (!ready) {
    return <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
  }

  if (loadError !== null) {
    return <p role="alert" className="text-sm text-destructive">{loadError}</p>
  }

  return (
    <div className="space-y-4">
      {isTrialReadOnly ? (
        <p className="text-sm text-amber-800 dark:text-amber-200" role="status">
          {t("trial.readOnlyHint")}
        </p>
      ) : null}
      <AssetWizard
        asPage
        mode="create"
        open
        readOnly={readOnly}
        units={units}
        categories={categories}
        families={families}
        onOpenChange={(next) => {
          if (!next) void navigate("/ativos")
        }}
        onCompleted={() => {
          void navigate("/ativos")
        }}
      />
    </div>
  )
}
