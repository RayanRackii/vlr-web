import { withCadastroPasso } from "@/features/assistant/useCadastroStep"

export const RESOURCE_WIZARD_STEPS = ["status", "rules", "prices", "agenda"] as const

export type ResourceWizardStepId = (typeof RESOURCE_WIZARD_STEPS)[number]

export function isResourceWizardStep(
  value: string | null | undefined,
): value is ResourceWizardStepId {
  return RESOURCE_WIZARD_STEPS.some((step) => step === value)
}

export function resourceWizardStepFromQuery(
  value: string | null | undefined,
): ResourceWizardStepId {
  return isResourceWizardStep(value) ? value : "status"
}

export function moveResourceWizardStep(
  current: ResourceWizardStepId,
  direction: -1 | 1,
): ResourceWizardStepId {
  const index = RESOURCE_WIZARD_STEPS.indexOf(current)
  const next = Math.min(
    RESOURCE_WIZARD_STEPS.length - 1,
    Math.max(0, index + direction),
  )
  return RESOURCE_WIZARD_STEPS[next] ?? "status"
}

export function resourceWizardPath(
  rentalAssetId: string,
  step: ResourceWizardStepId = "status",
): string {
  return withCadastroPasso(
    `/configuracoes/recursos/${encodeURIComponent(rentalAssetId)}/cadastro`,
    step,
  )
}

export function scheduleDeepLink(
  rentalAssetId: string,
  tab: "dia" | "semana" | "tipos",
  returnTo: string,
): string {
  const params = new URLSearchParams({
    rentalAssetId,
    aba: tab,
    returnTo,
  })
  return `/configuracoes/agenda?${params.toString()}`
}

export function menuDeepLink(returnTo: string): string {
  return `/configuracoes/menu?returnTo=${encodeURIComponent(returnTo)}`
}

export type ScheduleSurfaceTab = "daily" | "templates" | "kinds"

export function scheduleTabFromSearch(search: string): ScheduleSurfaceTab | null {
  const tab = new URLSearchParams(search).get("aba")
  if (tab === "semana" || tab === "templates") {
    return "templates"
  }
  if (tab === "tipos" || tab === "kinds") {
    return "kinds"
  }
  if (tab === "dia" || tab === "daily") {
    return "daily"
  }
  return null
}

export function scheduleAssetIdFromSearch(search: string): string | null {
  const id = new URLSearchParams(search).get("rentalAssetId")?.trim() ?? ""
  return id.length > 0 ? id : null
}
