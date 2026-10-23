import {
  getRentalsReadinessResponse,
  rentalsReadinessResponseSchema,
} from "@/api/generated/rentalsReadiness"
import i18n from "@/lib/i18n"
import { api } from "@/lib/api"

const readinessKeys = [
  "hasUnits",
  "hasRentableAssets",
  "hasScheduleTemplateOrRule",
  "hasBookingPolicy",
  "hasVisualOrMap",
] as const

type RentalsReadinessKey = (typeof readinessKeys)[number]

export type RentalsReadinessItem = {
  key: RentalsReadinessKey
  done: boolean
  count?: number
}

export type RentalsReadiness = {
  ready: boolean
  items: RentalsReadinessItem[]
}

function isReadinessKey(value: string): value is RentalsReadinessKey {
  return readinessKeys.includes(value as RentalsReadinessKey)
}

export async function getRentalsReadiness(): Promise<RentalsReadiness> {
  const response = await getRentalsReadinessResponse(api)
  const parsed = rentalsReadinessResponseSchema.safeParse(response.data)

  if (
    !parsed.success ||
    parsed.data.ready === undefined ||
    !Array.isArray(parsed.data.items) ||
    parsed.data.items.some(
      (item) =>
        item.done === undefined ||
        item.key === null ||
        item.key === undefined ||
        !isReadinessKey(item.key) ||
        item.count === null ||
        (item.count !== undefined && item.count < 0),
    )
  ) {
    console.error("getRentalsReadiness Zod validation failed", {
      data: response.data,
      error: parsed.success ? undefined : parsed.error.flatten(),
      issues: parsed.success ? undefined : parsed.error.issues,
    })
    throw new Error(i18n.t("apiErrors.invalidPayload"))
  }

  return {
    ready: parsed.data.ready,
    items: parsed.data.items.map((item) => ({
      key: item.key as RentalsReadinessKey,
      done: item.done as boolean,
      ...(typeof item.count === "number" ? { count: item.count } : {}),
    })),
  }
}
