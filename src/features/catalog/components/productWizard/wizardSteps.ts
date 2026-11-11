import { withCadastroPasso } from "@/features/assistant/useCadastroStep"

export const PRODUCT_WIZARD_STEPS = ["status", "offer", "access", "resource"] as const

export type ProductWizardStepId = (typeof PRODUCT_WIZARD_STEPS)[number]

export function isProductWizardStep(
  value: string | null | undefined,
): value is ProductWizardStepId {
  return PRODUCT_WIZARD_STEPS.some((step) => step === value)
}

export function productWizardStepFromQuery(
  value: string | null | undefined,
): ProductWizardStepId {
  return isProductWizardStep(value) ? value : "status"
}

export function moveProductWizardStep(
  current: ProductWizardStepId,
  direction: -1 | 1,
): ProductWizardStepId {
  const index = PRODUCT_WIZARD_STEPS.indexOf(current)
  const next = Math.min(
    PRODUCT_WIZARD_STEPS.length - 1,
    Math.max(0, index + direction),
  )
  return PRODUCT_WIZARD_STEPS[next] ?? "status"
}

export function productWizardPath(
  productId: string,
  step: ProductWizardStepId = "status",
): string {
  return withCadastroPasso(
    `/catalogo/produtos/${encodeURIComponent(productId)}/cadastro`,
    step,
  )
}

export function productGroupDeepLink(groupId: string, returnTo: string): string {
  return `/grupos/${encodeURIComponent(groupId)}?returnTo=${encodeURIComponent(returnTo)}`
}
