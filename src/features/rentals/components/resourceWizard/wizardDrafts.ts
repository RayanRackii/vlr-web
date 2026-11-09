import { HH_MM } from "@/lib/time24"

export const wizardPricingUnits = ["Hour", "Slot", "Day", "Fixed"] as const

export type WizardPricingUnit = (typeof wizardPricingUnits)[number]

export function parseWizardPrice(input: string): number | null {
  const normalized = input.trim().replace(/\s/g, "").replace(",", ".")
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    return null
  }
  const value = Number(normalized)
  if (!Number.isFinite(value) || value <= 0 || value > 1_000_000) {
    return null
  }
  return value
}

function minutes(value: string): number | null {
  if (!HH_MM.test(value)) {
    return null
  }
  const [hour, minute] = value.split(":")
  return Number(hour) * 60 + Number(minute)
}

export function wizardPriceDraftIsValid(draft: {
  amount: string
  startTime: string
  endTime: string
}): boolean {
  const start = minutes(draft.startTime)
  const end = minutes(draft.endTime)
  return parseWizardPrice(draft.amount) !== null && start !== null && end !== null && end > start
}

export function queueDraftIsValid(
  rentalType: "Location" | "Good",
  enabled: boolean,
  openingTime: string,
): boolean {
  if (rentalType !== "Location" || !enabled) {
    return true
  }
  return HH_MM.test(openingTime)
}
