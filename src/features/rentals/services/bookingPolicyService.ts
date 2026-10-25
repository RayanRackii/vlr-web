import i18n from "@/lib/i18n"
import { api, getAxiosErrorPayload, isAxiosError, parseApiError, publicApi } from "@/lib/api"
import {
  bookingPolicySchema,
  type BookingPolicy,
} from "@/features/rentals/schemas/bookingPolicySchemas"

const BOOKING_POLICY_PATH = "/api/rentals/booking-policy"

function parseBookingPolicy(data: unknown): BookingPolicy {
  const parsed = bookingPolicySchema.safeParse(data)
  if (!parsed.success) {
    throw new Error(i18n.t("apiErrors.invalidPayload"))
  }
  return parsed.data
}

function throwBookingPolicyError(error: unknown, fallbackKey: string): never {
  if (
    error instanceof Error &&
    !isAxiosError(error) &&
    error.message === i18n.t("apiErrors.invalidPayload")
  ) {
    throw error
  }

  throw new Error(
    parseApiError(getAxiosErrorPayload(error), i18n.t(fallbackKey)),
  )
}

function replaceBody(policy: BookingPolicy): {
  cancellationPolicyText: string | null
  maxActiveReservationsPerCustomerPerDay: number | null
  cancelCutoffHours?: number | null
  maxAdvanceBookingDays?: number | null
} {
  const body: {
    cancellationPolicyText: string | null
    maxActiveReservationsPerCustomerPerDay: number | null
    cancelCutoffHours?: number | null
    maxAdvanceBookingDays?: number | null
  } = {
    cancellationPolicyText: policy.cancellationPolicyText,
    maxActiveReservationsPerCustomerPerDay:
      policy.maxActiveReservationsPerCustomerPerDay,
  }
  if (policy.maxAdvanceBookingDays !== undefined) {
    body.maxAdvanceBookingDays = policy.maxAdvanceBookingDays
  }
  if (policy.cancelCutoffHours !== undefined) {
    body.cancelCutoffHours = policy.cancelCutoffHours
  }
  return body
}

export async function getBookingPolicy(): Promise<BookingPolicy> {
  try {
    const response = await api.get(BOOKING_POLICY_PATH)
    return parseBookingPolicy(response.data)
  } catch (error) {
    throwBookingPolicyError(error, "apiErrors.loadBookingPolicy")
  }
}

/**
 * PUT replaces the cancellation note and the daily cap.
 * `maxAdvanceBookingDays` is presence-aware: omitted keeps the stored horizon,
 * explicit null clears it, and a number replaces it.
 */
export async function replaceBookingPolicy(
  policy: BookingPolicy,
): Promise<BookingPolicy> {
  try {
    const response = await api.put(BOOKING_POLICY_PATH, replaceBody(policy))
    return parseBookingPolicy(response.data)
  } catch (error) {
    throwBookingPolicyError(error, "apiErrors.saveBookingPolicy")
  }
}

export async function fetchPublicBookingPolicy(
  subdomain: string,
): Promise<BookingPolicy> {
  try {
    const response = await publicApi.get(
      `/api/public/tenants/${subdomain}/booking-policy`,
    )
    return parseBookingPolicy(response.data)
  } catch (error) {
    throwBookingPolicyError(error, "apiErrors.loadBookingPolicy")
  }
}
