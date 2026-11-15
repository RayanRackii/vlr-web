import { itemStatus, productSetupSteps, type ItemStatus, type SetupStepId } from "@/features/assistant/itemStatus"
import { audienceBlocksSale, catalogMenuIsActive } from "@/features/catalog/components/productWizard/sellableChecklist"
import type { ProductWizardModel } from "@/features/catalog/components/productWizard/useProductWizard"

export type ProductSetup = {
  steps: Record<SetupStepId, boolean>
  status: ItemStatus
  firstMissing: SetupStepId | undefined
  missingCount: number
  linkedAssetIds: string[]
}

/** Read-only setup summary shared by the cadastro wizard and the product editor. */
export function productSetupFromModel(model: ProductWizardModel, rentalsActive: boolean): ProductSetup {
  const { product } = model
  const linkedAssetIds = (model.requirements ?? []).flatMap((row) => row.rentalAssetId ? [row.rentalAssetId] : [])
  const audienceReady = (model.access?.visibility ?? product.visibility) !== "Restricted"
    || (model.access !== null && model.groups !== null && !audienceBlocksSale(model.access, model.groups))
  const steps = productSetupSteps({
    name: product.name,
    isActive: product.isActive,
    price: product.price,
    audienceReady,
    agendaReady: !rentalsActive || linkedAssetIds.length > 0,
    menuPublished: model.menuItems === null ? null : catalogMenuIsActive(model.menuItems),
  })
  const status = itemStatus(product.isActive && model.menuItems !== null && catalogMenuIsActive(model.menuItems), steps)
  const missing = (Object.keys(steps) as SetupStepId[]).filter((step) => !steps[step])
  return { steps, status, firstMissing: missing[0], missingCount: missing.length, linkedAssetIds }
}
