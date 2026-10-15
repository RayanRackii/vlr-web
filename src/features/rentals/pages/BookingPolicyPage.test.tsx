import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { BookingPolicyPage } from "@/features/rentals/pages/BookingPolicyPage"
import {
  getBookingPolicy,
  replaceBookingPolicy,
} from "@/features/rentals/services/bookingPolicyService"
import { TestPermissionProvider } from "@/features/users/permissions/PermissionContext"
import i18n from "@/lib/i18n"
import { toast } from "sonner"

const trial = vi.hoisted(() => ({ readOnly: false }))

vi.mock("@/features/users/hooks/useTrialStatus", () => ({
  useTrialStatus: () => ({
    isLoading: false,
    isTrial: trial.readOnly,
    isTrialReadOnly: trial.readOnly,
    trialEndsAt: undefined,
    trialPurgeAt: undefined,
  }),
}))

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock("@/features/rentals/services/bookingPolicyService", () => ({
  getBookingPolicy: vi.fn(),
  replaceBookingPolicy: vi.fn(),
}))

const getPolicy = vi.mocked(getBookingPolicy)
const replacePolicy = vi.mocked(replaceBookingPolicy)
const toastSuccess = vi.mocked(toast.success)
const toastError = vi.mocked(toast.error)

const WRITE = ["rentals.booking_policy.read", "rentals.booking_policy.write"]

function renderPage(permissions: readonly string[] = WRITE) {
  return render(
    <TestPermissionProvider permissions={permissions}>
      <BookingPolicyPage />
    </TestPermissionProvider>,
  )
}

describe("BookingPolicyPage", () => {
  beforeEach(() => {
    trial.readOnly = false
    getPolicy.mockReset()
    replacePolicy.mockReset()
    toastSuccess.mockReset()
    toastError.mockReset()
    getPolicy.mockResolvedValue({
      cancellationPolicyText: "Bring a document.",
      maxActiveReservationsPerCustomerPerDay: 3,
    })
    replacePolicy.mockImplementation(async (policy) => policy)
  })

  it("loads both fields and saves a full replacement", async () => {
    const user = userEvent.setup()
    renderPage()

    const text = await screen.findByLabelText(
      i18n.t("rentals.bookingPolicy.cancellationLabel"),
    )
    expect(text).toHaveValue("Bring a document.")
    expect(text.tagName).toBe("TEXTAREA")
    expect(
      screen.getByRole("switch", {
        name: i18n.t("rentals.bookingPolicy.dailyLimitToggle"),
      }),
    ).toBeChecked()
    expect(
      screen.getByLabelText(i18n.t("rentals.bookingPolicy.dailyLimitValue")),
    ).toHaveValue("3")

    await user.clear(text)
    await user.type(text, "<b>See you there.</b>")
    await user.clear(
      screen.getByLabelText(i18n.t("rentals.bookingPolicy.dailyLimitValue")),
    )
    await user.type(
      screen.getByLabelText(i18n.t("rentals.bookingPolicy.dailyLimitValue")),
      "2",
    )
    await user.click(
      screen.getByRole("button", {
        name: i18n.t("rentals.bookingPolicy.save"),
      }),
    )

    await waitFor(() => {
      expect(replacePolicy).toHaveBeenCalledWith({
        cancellationPolicyText: "<b>See you there.</b>",
        maxActiveReservationsPerCustomerPerDay: 2,
      })
    })
    expect(toastSuccess).toHaveBeenCalledWith(
      i18n.t("rentals.bookingPolicy.saved"),
    )
    expect(text).toHaveValue("<b>See you there.</b>")
  })

  it("sends null for blank text and an unlimited day", async () => {
    const user = userEvent.setup()
    renderPage()

    const text = await screen.findByLabelText(
      i18n.t("rentals.bookingPolicy.cancellationLabel"),
    )
    await user.clear(text)
    await user.click(
      screen.getByRole("switch", {
        name: i18n.t("rentals.bookingPolicy.dailyLimitToggle"),
      }),
    )
    await user.click(
      screen.getByRole("button", {
        name: i18n.t("rentals.bookingPolicy.save"),
      }),
    )

    await waitFor(() => {
      expect(replacePolicy).toHaveBeenCalledWith({
        cancellationPolicyText: null,
        maxActiveReservationsPerCustomerPerDay: null,
      })
    })
  })

  it("disables save until the daily limit is inside 1..100", async () => {
    const user = userEvent.setup()
    getPolicy.mockResolvedValue({
      cancellationPolicyText: null,
      maxActiveReservationsPerCustomerPerDay: null,
    })
    renderPage()

    await screen.findByLabelText(
      i18n.t("rentals.bookingPolicy.cancellationLabel"),
    )
    await user.click(
      screen.getByRole("switch", {
        name: i18n.t("rentals.bookingPolicy.dailyLimitToggle"),
      }),
    )

    const save = screen.getByRole("button", {
      name: i18n.t("rentals.bookingPolicy.save"),
    })
    expect(save).toBeDisabled()

    const limit = screen.getByLabelText(
      i18n.t("rentals.bookingPolicy.dailyLimitValue"),
    )
    await user.type(limit, "101")
    expect(save).toBeDisabled()
    expect(replacePolicy).not.toHaveBeenCalled()

    await user.clear(limit)
    await user.type(limit, "1")
    expect(save).toBeEnabled()
  })

  it("keeps the form and re-enables save when the API rejects the replacement", async () => {
    const user = userEvent.setup()
    replacePolicy.mockRejectedValue(
      new Error("Cancellation policy text must be at most 2000 characters."),
    )
    renderPage()

    const text = await screen.findByLabelText(
      i18n.t("rentals.bookingPolicy.cancellationLabel"),
    )
    await user.click(
      screen.getByRole("button", {
        name: i18n.t("rentals.bookingPolicy.save"),
      }),
    )

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith(
        "Cancellation policy text must be at most 2000 characters.",
      )
    })
    expect(text).toHaveValue("Bring a document.")
    expect(
      screen.getByRole("button", {
        name: i18n.t("rentals.bookingPolicy.save"),
      }),
    ).toBeEnabled()
  })

  it("hides save without write permission and shows the loaded text", async () => {
    renderPage(["rentals.booking_policy.read"])

    const text = await screen.findByLabelText(
      i18n.t("rentals.bookingPolicy.cancellationLabel"),
    )
    expect(text).toBeDisabled()
    expect(text).toHaveValue("Bring a document.")
    expect(
      screen.queryByRole("button", {
        name: i18n.t("rentals.bookingPolicy.save"),
      }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByText(i18n.t("rentals.bookingPolicy.readOnly")),
    ).toBeInTheDocument()
  })

  it("hides save when the trial is read-only", async () => {
    trial.readOnly = true
    renderPage()

    await screen.findByLabelText(
      i18n.t("rentals.bookingPolicy.cancellationLabel"),
    )
    expect(
      screen.queryByRole("button", {
        name: i18n.t("rentals.bookingPolicy.save"),
      }),
    ).not.toBeInTheDocument()
  })

  it("shows the load error and retries", async () => {
    const user = userEvent.setup()
    getPolicy
      .mockRejectedValueOnce(new Error("policy down"))
      .mockResolvedValueOnce({
        cancellationPolicyText: "After retry",
        maxActiveReservationsPerCustomerPerDay: null,
      })
    renderPage()

    expect(await screen.findByText("policy down")).toBeInTheDocument()
    await user.click(
      screen.getByRole("button", {
        name: i18n.t("rentals.bookingPolicy.retry"),
      }),
    )

    expect(
      await screen.findByLabelText(
        i18n.t("rentals.bookingPolicy.cancellationLabel"),
      ),
    ).toHaveValue("After retry")
  })
})
