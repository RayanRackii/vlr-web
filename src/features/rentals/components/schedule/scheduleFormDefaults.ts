import type { UpsertOccupancyKindInput } from "@/features/rentals/services/scheduleService"
import { brazilTodayIsoDate } from "@/lib/brazilTimeZone"

export function todayIsoDate(): string {
  return brazilTodayIsoDate()
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
