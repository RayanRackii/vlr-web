import type { UpsertOccupancyKindInput } from "@/features/rentals/services/scheduleService"

export function todayIsoDate(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `${now.getFullYear()}-${month}-${day}`
}

export function emptyKindForm(): UpsertOccupancyKindInput {
  return {
    key: "",
    label: "",
    description: "",
    colorHex: "#22c55e",
    iconKey: "circle-check",
    isBookableByCustomer: true,
    blocksCapacity: true,
    sortOrder: 100,
    isActive: true,
  }
}

export type TemplateDraft = {
  dayOfWeek: string
  startTime: string
  endTime: string
  occupancyKindId: string
  label: string
  isActive: boolean
}

export function emptyTemplateDraft(kindId: string): TemplateDraft {
  return {
    dayOfWeek: "Monday",
    startTime: "08:00",
    endTime: "09:00",
    occupancyKindId: kindId,
    label: "",
    isActive: true,
  }
}
