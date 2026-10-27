import { FeatureRouteTabs } from "@/components/layout/FeatureRouteTabs"
import { equipmentTabs } from "@/features/assets/navigationTabs"
import { AssetsPage } from "@/features/assets/pages/AssetsPage"
import { AssetCategoriesPage } from "@/features/assets/pages/AssetCategoriesPage"

export function EquipmentPage() {
  return (
    <FeatureRouteTabs
      labelKey="nav.assets"
      tabs={equipmentTabs}
      content={{
        "/ativos": <AssetsPage />,
        "/ativos/categorias": <AssetCategoriesPage />,
      }}
    />
  )
}
