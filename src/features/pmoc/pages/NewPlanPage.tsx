import { useTranslation } from "react-i18next"
import { useLocation } from "react-router-dom"

import { PageHeader } from "@/components/layout/PageHeader"
import { FeatureRouteTabs } from "@/components/layout/FeatureRouteTabs"
import { newPlanTabs } from "@/features/pmoc/navigationTabs"
import { CreatePlanPage } from "@/features/pmoc/pages/CreatePlanPage"
import { PmocLibraryPage } from "@/features/pmoc/pages/PmocLibraryPage"

export function NewPlanPage() {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  // The library tab is a catalog of templates, not the "new plan" form: name it for what it is.
  const title = t(pathname.replace(/\/+$/, "") === "/pmoc/biblioteca" ? "nav.pmocLibrary" : "nav.pmocNew")
  return (
    <FeatureRouteTabs
      labelKey="nav.pmocNew"
      tabs={newPlanTabs}
      header={<PageHeader title={title} className="mb-0 sm:mb-0" />}
      content={{
        "/pmoc/novo": <CreatePlanPage />,
        "/pmoc/biblioteca": <PmocLibraryPage />,
      }}
    />
  )
}
