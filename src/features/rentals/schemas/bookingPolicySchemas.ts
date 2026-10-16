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
   * Null means unlimited. The replace body omits it so a policy save keeps
   * the stored horizon.
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

export type BookingPolicyFormValues = {
  cancellationPolicyText: string
  dailyLimitEnabled: boolean
  dailyLimit: string
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

export function bookingPolicyToFormValues(
  policy: BookingPolicy,
): BookingPolicyFormValues {
  return {
    cancellationPolicyText: policy.cancellationPolicyText ?? "",
    dailyLimitEnabled: policy.maxActiveReservationsPerCustomerPerDay !== null,
    dailyLimit:
      policy.maxActiveReservationsPerCustomerPerDay === null
        ? ""
        : String(policy.maxActiveReservationsPerCustomerPerDay),
  }
}

export function createBookingPolicyFormSchema(messages: {
  textMax: string
  limitRange: string
}) {
  return z
    .object({
      cancellationPolicyText: z
        .string()
        .max(BOOKING_POLICY_TEXT_MAX_LENGTH, messages.textMax),
      dailyLimitEnabled: z.boolean(),
      dailyLimit: z.string(),
    })
    .superRefine((value, context) => {
      if (!value.dailyLimitEnabled) {
        return
      }

      if (parseDailyLimitInput(value.dailyLimit) === null) {
        context.addIssue({
          code: "custom",
          path: ["dailyLimit"],
          message: messages.limitRange,
        })
      }
    })
}

/** Full replace body. Blank text becomes null. An invalid limit is refused. */
export function toBookingPolicyReplaceBody(
  values: BookingPolicyFormValues,
): BookingPolicy {
  const text = values.cancellationPolicyText.trim()
  const limit = values.dailyLimitEnabled
    ? parseDailyLimitInput(values.dailyLimit)
    : null

  if (values.dailyLimitEnabled && limit === null) {
    throw new Error("Daily limit is invalid.")
  }

  return {
    cancellationPolicyText: text.length === 0 ? null : text,
    maxActiveReservationsPerCustomerPerDay: limit,
  }
}
