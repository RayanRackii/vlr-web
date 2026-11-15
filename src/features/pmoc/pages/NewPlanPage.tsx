import { useTranslation } from "react-i18next"

import { PageHeader } from "@/components/layout/PageHeader"
import { FeatureRouteTabs } from "@/components/layout/FeatureRouteTabs"
import { newPlanTabs } from "@/features/pmoc/navigationTabs"
import { CreatePlanPage } from "@/features/pmoc/pages/CreatePlanPage"
import { PmocLibraryPage } from "@/features/pmoc/pages/PmocLibraryPage"

export function NewPlanPage() {
  const { t } = useTranslation()
  return (
    <FeatureRouteTabs
      labelKey="nav.pmocNew"
      tabs={newPlanTabs}
      header={<PageHeader title={t("nav.pmocNew")} className="mb-0 sm:mb-0" />}
      content={{
        "/pmoc/novo": <CreatePlanPage />,
        "/pmoc/biblioteca": <PmocLibraryPage />,
      }}
    />
  )
}
