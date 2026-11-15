import type { CadastroStep } from "@/features/assistant/useCadastroStep"
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

/** Agenda applies only with the rentals module and a product that uses the schedule; then it needs a linked resource. */
export function productAgendaReady(rentalsActive: boolean, usesSchedule: boolean, linkedAssetCount: number): boolean {
  return !rentalsActive || !usesSchedule || linkedAssetCount > 0
}

/** Cadastro steps that do not apply: Agenda and Fila for a product that does not use the schedule (rentals tenants only). */
export function productNotApplicableSteps(usesSchedule: boolean, rentalsActive: boolean): CadastroStep[] {
  return rentalsActive && !usesSchedule ? ["agenda", "fila"] : []
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
    agendaReady: productAgendaReady(rentalsActive, product.usesSchedule, linkedAssetIds.length),
    menuPublished: model.menuItems === null ? null : catalogMenuIsActive(model.menuItems),
  })
  const status = itemStatus(product.isActive && model.menuItems !== null && catalogMenuIsActive(model.menuItems), steps)
  const missing = (Object.keys(steps) as SetupStepId[]).filter((step) => !steps[step])
  return { steps, status, firstMissing: missing[0], missingCount: missing.length, linkedAssetIds }
}
