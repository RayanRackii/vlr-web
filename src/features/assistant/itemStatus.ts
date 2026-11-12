/**
 * One status for a bookable resource or a product.
 * Publicado only when every setup step is done and customers can already find it.
 * Falta N when a step is still open. Rascunho when the steps are done and it is not published.
 * Publication is the existing active flag plus the portal menu, not a new field.
 */
export const setupStepIds = ["dados", "agenda", "fila", "regras", "precos"] as const

export type SetupStepId = (typeof setupStepIds)[number]

export type ItemStatus =
  | { kind: "published" }
  | { kind: "draft" }
  | { kind: "missing"; count: number; gap?: string }

export function statusFromServer(state: string, missing: readonly string[]): ItemStatus | null {
  if (state === "published") return { kind: "published" }
  if (state === "draft") return { kind: "draft" }
  if (state === "missing") return { kind: "missing", count: Math.max(missing.length, 1), gap: missing[0] }
  return null
}

export function statusFromMissing(published: boolean, missingCount: number): ItemStatus {
  if (missingCount > 0) return { kind: "missing", count: missingCount }
  return published ? { kind: "published" } : { kind: "draft" }
}

export function itemStatus(published: boolean, steps: Record<SetupStepId, boolean>): ItemStatus {
  return statusFromMissing(published, setupStepIds.filter((step) => !steps[step]).length)
}

function filled(value: string | null | undefined): boolean {
  return (value?.trim().length ?? 0) > 0
}

export type ResourceStatusInput = {
  name: string
  isActive: boolean
  type: "Location" | "Good"
  schedulePolicy: "SlotGrid" | "OpenHours"
  openTime?: string | null
  closeTime?: string | null
  queueEnabled: boolean
  queueOpeningTime?: string | null
  allowedDurationMinutes?: string | null
  cancelCutoffHours?: number | null
  /** True when an active portal menu item covers this resource. Null when the menu could not be read. */
  menuPublished: boolean | null
  /** True when this SlotGrid resource has an active weekly template. Ignored for open hours. */
  hasActiveTemplate: boolean
  hasPrice: boolean
}

export function resourceSetupSteps(input: ResourceStatusInput): Record<SetupStepId, boolean> {
  const agenda = input.schedulePolicy === "OpenHours"
    ? filled(input.openTime) && filled(input.closeTime)
    : input.hasActiveTemplate
  const fila = input.type !== "Location" || !input.queueEnabled || filled(input.queueOpeningTime)
  const regras = filled(input.allowedDurationMinutes) && (input.cancelCutoffHours != null)
  return {
    dados: filled(input.name),
    agenda,
    fila,
    regras,
    precos: input.hasPrice,
  }
}

export function resourceItemStatus(input: ResourceStatusInput): ItemStatus {
  const steps = resourceSetupSteps(input)
  return itemStatus(input.isActive && input.menuPublished === true, steps)
}

export type ProductStatusInput = {
  name: string
  isActive: boolean
  price: number | null
  /** Public audience, or a restricted audience that can actually buy. */
  audienceReady: boolean
  /** A linked bookable resource, or no rentals module so the step does not apply. */
  agendaReady: boolean
  /** True when the catalog is on the customer menu. Null when the menu could not be read. */
  menuPublished: boolean | null
}

export function productSetupSteps(input: ProductStatusInput): Record<SetupStepId, boolean> {
  const agenda = input.agendaReady
  return {
    dados: filled(input.name),
    agenda,
    fila: agenda,
    regras: input.audienceReady,
    precos: input.price != null && input.price > 0,
  }
}

export function productItemStatus(input: ProductStatusInput): ItemStatus {
  return itemStatus(input.isActive && input.menuPublished === true, productSetupSteps(input))
}
