import { useTranslation } from "react-i18next"

import { PageHeader } from "@/components/layout/PageHeader"
import { FeatureRouteTabs } from "@/components/layout/FeatureRouteTabs"
import { equipmentTabs } from "@/features/assets/navigationTabs"
import { AssetsPage } from "@/features/assets/pages/AssetsPage"
import { ResourceTypesPage } from "@/features/assets/pages/ResourceTypesPage"

export function EquipmentPage() {
  const { t } = useTranslation()
  return (
    <FeatureRouteTabs
      labelKey="nav.assets"
      tabs={equipmentTabs}
      header={<PageHeader title={t("nav.assets")} className="mb-0 sm:mb-0" />}
      content={{
        "/ativos": <AssetsPage />,
        "/ativos/tipos": <ResourceTypesPage />,
      }}
    />
  )
}
