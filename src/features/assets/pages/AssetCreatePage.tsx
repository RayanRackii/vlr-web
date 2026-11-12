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

export function AssetCreatePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [units, setUnits] = useState<Unit[]>([])
  const [categories, setCategories] = useState<AssetCategory[]>([])
  const [families, setFamilies] = useState<AssetFamily[]>([])
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let active = true
    void Promise.all([getUnits(), getCategories(), listActiveAssetFamilies()]).then(([nextUnits, nextCategories, nextFamilies]) => {
      if (!active) return
      setUnits(nextUnits)
      setCategories(nextCategories)
      setFamilies(nextFamilies)
      setReady(true)
    }).catch(() => {
      if (active) setReady(true)
    })
    return () => {
      active = false
    }
  }, [])

  if (!ready) {
    return <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
  }

  return (
    <AssetWizard
      asPage
      mode="create"
      open
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
  )
}
