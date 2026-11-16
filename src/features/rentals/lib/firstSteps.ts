import type { SetupStatus } from "@/features/rentals/services/setupStatusService"

export const FIRST_STEP_KEYS = ["company", "pricedOffer", "hours", "resource", "admin", "previewItem"] as const
export type FirstStepKey = (typeof FIRST_STEP_KEYS)[number]

/**
 * Screen where each step is done. Company data and the customer preview have no staff screen
 * (the company profile is only editable by platform admins), so they stay unlinked.
 */
export const FIRST_STEP_HREF: Partial<Record<FirstStepKey, string>> = {
  pricedOffer: "/catalogo/produtos",
  hours: "/configuracoes/agenda",
  resource: "/configuracoes/recursos",
  admin: "/pessoas-e-acesso",
}

/** Steps still open. The customer preview is informational, so it is not counted. */
export function missingStepCount(status: SetupStatus): number {
  return status.checklist.filter((item) => item.key !== "preview" && item.state !== "published").length
}
