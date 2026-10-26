import { AxiosError, type InternalAxiosRequestConfig } from "axios"
import { describe, expect, it } from "vitest"

import {
  describeBookingError,
  isBookingHorizonError,
  isDailyBookingLimitError,
  isCancelCutoffError,
  isSlotTakenConflict,
  isSlotUnavailableConflict,
  portalBookingErrorFromUnknown,
  readDailyBookingLimit,
} from "@/features/tenantPortal/lib/portalBookingError"
import { getReservationQueueErrorCode } from "@/features/tenantPortal/services/tenantPortalService"
import i18n from "@/lib/i18n"

function axiosError(status: number, data: unknown): AxiosError {
  return new AxiosError("boom", undefined, undefined, undefined, {
    status,
    statusText: "Error",
    data,
    headers: {},
    config: { headers: {} } as InternalAxiosRequestConfig,
  })
}

describe("portal booking failures", () => {
  it("reads the daily cap code and the limit in the message", () => {
    const error = portalBookingErrorFromUnknown(
      axiosError(409, {
        error: "Limite de 2 reservas ativas por dia atingido.",
        code: "DAILY_BOOKING_LIMIT_REACHED",
      }),
      i18n.t("apiErrors.bookSlot"),
    )

    expect(isDailyBookingLimitError(error)).toBe(true)
    expect(readDailyBookingLimit(error)).toBe(2)
    expect(isSlotTakenConflict(error)).toBe(false)
  })

  it("uses the translated fallback when the daily-limit payload has no number", () => {
    const error = portalBookingErrorFromUnknown(
      axiosError(409, {
        error: "limit reached",
        code: "DAILY_BOOKING_LIMIT_REACHED",
      }),
      i18n.t("apiErrors.bookSlot"),
    )

    expect(readDailyBookingLimit(error)).toBeNull()
  })

  it("treats a taken slot as a conflict and leaves other 409s alone", () => {
    const taken = portalBookingErrorFromUnknown(
      axiosError(409, {
        error: "O local 'Sala 1' não está disponível para o intervalo solicitado.",
      }),
      i18n.t("apiErrors.createReservation"),
    )
    const english = portalBookingErrorFromUnknown(
      axiosError(409, {
        error: "Location is already reserved for this interval.",
      }),
      i18n.t("apiErrors.bookSlot"),
    )
    const unavailable = portalBookingErrorFromUnknown(
      axiosError(409, { error: "Slot is not available for booking." }),
      i18n.t("apiErrors.bookSlot"),
    )
    const quantity = portalBookingErrorFromUnknown(
      axiosError(409, { error: "Insufficient quantity for this slot." }),
      i18n.t("apiErrors.bookSlot"),
    )
    const wrongUnit = portalBookingErrorFromUnknown(
      axiosError(409, { error: "Slot does not belong to the given unit." }),
      i18n.t("apiErrors.bookSlot"),
    )

    expect(isSlotTakenConflict(taken)).toBe(true)
    expect(isSlotTakenConflict(english)).toBe(true)
    expect(isSlotTakenConflict(unavailable)).toBe(false)
    expect(isSlotTakenConflict(quantity)).toBe(false)
    expect(isSlotTakenConflict(wrongUnit)).toBe(false)
    expect(isSlotUnavailableConflict(unavailable)).toBe(true)
    expect(isSlotUnavailableConflict(quantity)).toBe(true)
    expect(isSlotUnavailableConflict(taken)).toBe(false)
    expect(isSlotUnavailableConflict(english)).toBe(false)
    expect(isSlotUnavailableConflict(wrongUnit)).toBe(false)
  })

  it("keeps queue codes recognizable and out of the slot-taken path", () => {
    const error = portalBookingErrorFromUnknown(
      axiosError(409, { error: "QUEUE_REQUIRED" }),
      i18n.t("apiErrors.bookSlot"),
    )

    expect(getReservationQueueErrorCode(error)).toBe("QUEUE_REQUIRED")
    expect(isSlotTakenConflict(error)).toBe(false)
    expect(isDailyBookingLimitError(error)).toBe(false)
  })

  it("translates a booking horizon rejection", async () => {
    const error = portalBookingErrorFromUnknown(
      axiosError(400, {
        error: "A data solicitada está além do horizonte de reserva.",
        code: "booking_horizon_exceeded",
      }),
      i18n.t("apiErrors.bookSlot"),
    )

    expect(isBookingHorizonError(error)).toBe(true)
    await i18n.changeLanguage("en")
    expect(describeBookingError(error, "fallback", 7)).toBe(
      "You can book up to 7 days ahead.",
    )
    await i18n.changeLanguage("es")
    expect(describeBookingError(error, "fallback")).toBe(
      "La fecha pedida supera el límite de reserva.",
    )
    await i18n.changeLanguage("pt-BR")
  })
})


it.each([0, 24, 8760])("translates cancel cutoff 409 with %i hours", (hours) => {
  const error = portalBookingErrorFromUnknown(axiosError(409, { code: "cancel_cutoff_passed", cancelCutoffHours: hours }), "fallback")
  expect(isCancelCutoffError(error)).toBe(true)
  expect(error.cancelCutoffHours).toBe(hours)
  expect(describeBookingError(error, "fallback")).toBe(i18n.t("tenantPortal.agenda.cancelCutoffPassed", { hours }))
})
it("does not classify another status or code as a cancel cutoff", () => {
  expect(isCancelCutoffError(portalBookingErrorFromUnknown(axiosError(500, { code: "cancel_cutoff_passed" }), "fallback"))).toBe(false)
  expect(isCancelCutoffError(portalBookingErrorFromUnknown(axiosError(409, { code: "other" }), "fallback"))).toBe(false)
})
