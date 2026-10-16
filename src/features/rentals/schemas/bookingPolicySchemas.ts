import { z } from "zod"

export const BOOKING_POLICY_TEXT_MAX_LENGTH = 2000
export const BOOKING_POLICY_DAILY_LIMIT_MIN = 1
export const BOOKING_POLICY_DAILY_LIMIT_MAX = 100

export const BOOKING_HORIZON_DAY_MIN = 0
export const BOOKING_HORIZON_DAY_MAX = 3650

export const bookingPolicySchema = z.object({
  cancellationPolicyText: z.string().nullable(),
  maxActiveReservationsPerCustomerPerDay: z
    .number()
    .int()
    .min(BOOKING_POLICY_DAILY_LIMIT_MIN)
    .max(BOOKING_POLICY_DAILY_LIMIT_MAX)
    .nullable(),
  /**
   * Tenant horizon in civil days. Absent means this payload did not say.
   * Null means unlimited. A replace body includes it only when the value
   * changed: omitted keeps the stored horizon, null clears it, a number
   * replaces it.
   */
  maxAdvanceBookingDays: z
    .number()
    .int()
    .min(BOOKING_HORIZON_DAY_MIN)
    .max(BOOKING_HORIZON_DAY_MAX)
    .nullable()
    .optional(),
})

export type BookingPolicy = z.infer<typeof bookingPolicySchema>

export const tenantHorizonModes = ["unlimited", "days"] as const

export type TenantHorizonMode = (typeof tenantHorizonModes)[number]

export type BookingPolicyFormValues = {
  cancellationPolicyText: string
  dailyLimitEnabled: boolean
  dailyLimit: string
  horizonMode: TenantHorizonMode
  horizonDays: string
}

export function parseDailyLimitInput(value: string): number | null {
  const trimmed = value.trim()
  if (!/^\d+$/.test(trimmed)) {
    return null
  }

  const parsed = Number(trimmed)
  if (
    !Number.isInteger(parsed) ||
    parsed < BOOKING_POLICY_DAILY_LIMIT_MIN ||
    parsed > BOOKING_POLICY_DAILY_LIMIT_MAX
  ) {
    return null
  }

  return parsed
}

/** Integers from 0 to 3650. Blank, fractional, and out-of-range input is null. */
export function parseHorizonDaysInput(value: string): number | null {
  const trimmed = value.trim()
  if (!/^\d+$/.test(trimmed)) {
    return null
  }

  const parsed = Number(trimmed)
  if (
    !Number.isInteger(parsed) ||
    parsed < BOOKING_HORIZON_DAY_MIN ||
    parsed > BOOKING_HORIZON_DAY_MAX
  ) {
    return null
  }

  return parsed
}

export function bookingPolicyToFormValues(
  policy: BookingPolicy,
): BookingPolicyFormValues {
  const horizon = policy.maxAdvanceBookingDays
  return {
    cancellationPolicyText: policy.cancellationPolicyText ?? "",
    dailyLimitEnabled: policy.maxActiveReservationsPerCustomerPerDay !== null,
    dailyLimit:
      policy.maxActiveReservationsPerCustomerPerDay === null
        ? ""
        : String(policy.maxActiveReservationsPerCustomerPerDay),
    horizonMode: typeof horizon === "number" ? "days" : "unlimited",
    horizonDays: typeof horizon === "number" ? String(horizon) : "",
  }
}

/**
 * `undefined` omits the property (stored horizon stays).
 * `null` clears it. A number replaces it.
 * An absent loaded value plus "unlimited" stays omitted.
 */
export function resolveTenantHorizonWrite(
  mode: TenantHorizonMode,
  daysInput: string,
  loaded: number | null | undefined,
): number | null | undefined {
  if (mode === "days") {
    const days = parseHorizonDaysInput(daysInput)
    if (days === null) {
      throw new Error("Booking horizon is invalid.")
    }
    return loaded === days ? undefined : days
  }

  if (loaded === undefined || loaded === null) {
    return undefined
  }

  return null
}

export function createBookingPolicyFormSchema(messages: {
  textMax: string
  limitRange: string
  horizonRange: string
}) {
  return z
    .object({
      cancellationPolicyText: z
        .string()
        .max(BOOKING_POLICY_TEXT_MAX_LENGTH, messages.textMax),
      dailyLimitEnabled: z.boolean(),
      dailyLimit: z.string(),
      horizonMode: z.enum(tenantHorizonModes),
      horizonDays: z.string(),
    })
    .superRefine((value, context) => {
      if (
        value.dailyLimitEnabled &&
        parseDailyLimitInput(value.dailyLimit) === null
      ) {
        context.addIssue({
          code: "custom",
          path: ["dailyLimit"],
          message: messages.limitRange,
        })
      }

      if (
        value.horizonMode === "days" &&
        parseHorizonDaysInput(value.horizonDays) === null
      ) {
        context.addIssue({
          code: "custom",
          path: ["horizonDays"],
          message: messages.horizonRange,
        })
      }
    })
}

/**
 * Full replace of the cancellation note and the daily cap.
 * `maxAdvanceBookingDays` is included only when it changed.
 */
export function toBookingPolicyReplaceBody(
  values: BookingPolicyFormValues,
  loadedHorizon?: number | null,
): BookingPolicy {
  const text = values.cancellationPolicyText.trim()
  const limit = values.dailyLimitEnabled
    ? parseDailyLimitInput(values.dailyLimit)
    : null

  if (values.dailyLimitEnabled && limit === null) {
    throw new Error("Daily limit is invalid.")
  }

  const body: BookingPolicy = {
    cancellationPolicyText: text.length === 0 ? null : text,
    maxActiveReservationsPerCustomerPerDay: limit,
  }
  const horizon = resolveTenantHorizonWrite(
    values.horizonMode,
    values.horizonDays,
    loadedHorizon,
  )
  if (horizon !== undefined) {
    body.maxAdvanceBookingDays = horizon
  }
  return body
}
