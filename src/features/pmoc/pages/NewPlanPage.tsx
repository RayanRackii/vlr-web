import { FeatureRouteTabs } from "@/components/layout/FeatureRouteTabs"
import { newPlanTabs } from "@/features/pmoc/navigationTabs"
import { CreatePlanPage } from "@/features/pmoc/pages/CreatePlanPage"
import { PmocLibraryPage } from "@/features/pmoc/pages/PmocLibraryPage"

export function NewPlanPage() {
  return (
    <FeatureRouteTabs
      labelKey="nav.pmocNew"
      tabs={newPlanTabs}
      content={{
        "/pmoc/novo": <CreatePlanPage />,
        "/pmoc/biblioteca": <PmocLibraryPage />,
      }}
    />
  )
}
