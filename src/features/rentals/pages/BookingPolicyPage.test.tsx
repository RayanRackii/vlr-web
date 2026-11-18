import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { BookingPolicyPage } from "@/features/rentals/pages/BookingPolicyPage"
import {
  getBookingPolicy,
  getCategoryBookingPolicies,
  replaceBookingPolicy,
  replaceCategoryBookingPolicy,
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
  getCategoryBookingPolicies: vi.fn(),
  replaceCategoryBookingPolicy: vi.fn(),
}))

const getCategories = vi.mocked(getCategoryBookingPolicies)
const replaceCategory = vi.mocked(replaceCategoryBookingPolicy)

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

const t = (key: string) => i18n.t(`rentals.bookingPolicy.${key}`)
const saveButton = () => screen.getByRole("button", { name: t("save") })
const rule = (id: string) => within(screen.getByTestId(id))
const unlimitedBox = (id: string) => rule(id).getByRole("checkbox")

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
    getCategories.mockReset()
    replaceCategory.mockReset()
    getCategories.mockResolvedValue([])
  })

  it("saves general rules and changed category rows with one Save and no per-row buttons", async () => {
    const user = userEvent.setup()
    getCategories.mockResolvedValue([
      { categoryId: "c1", categoryName: "Goods", maxAdvanceBookingDays: null, cancelCutoffHours: 24 },
      { categoryId: "c2", categoryName: "Other", maxAdvanceBookingDays: 5, cancelCutoffHours: null },
    ])
    replaceCategory.mockImplementation(async (categoryId, values) => ({
      categoryId,
      categoryName: "Goods",
      ...values,
    }))
    renderPage()

    const row = await screen.findByTestId("category-policy-c1")
    expect(row).toHaveTextContent("Goods")
    expect(within(row).queryByRole("button")).not.toBeInTheDocument()
    const [days, hours] = Array.from(row.querySelectorAll("input"))
    expect(hours).toHaveValue("24")
    expect(saveButton()).toBeDisabled()

    await user.type(days, "30")
    await user.clear(hours)
    expect(saveButton()).toBeEnabled()
    // General rule edited in the same session.
    await user.click(unlimitedBox("rule-horizon"))
    await user.type(screen.getByLabelText(t("horizonDays")), "14")
    await user.click(saveButton())

    await waitFor(() =>
      expect(replaceCategory).toHaveBeenCalledWith("c1", {
        maxAdvanceBookingDays: 30,
        cancelCutoffHours: null,
      }),
    )
    expect(replaceCategory).toHaveBeenCalledTimes(1)
    expect(replacePolicy).toHaveBeenCalledWith({
      cancellationPolicyText: "Bring a document.",
      maxActiveReservationsPerCustomerPerDay: 3,
      maxAdvanceBookingDays: 14,
    })
    expect(toastSuccess).toHaveBeenCalledWith(t("saved"))
  })

  it("saves only the category rows when the general rules did not change", async () => {
    const user = userEvent.setup()
    getCategories.mockResolvedValue([
      { categoryId: "c1", categoryName: "Goods", maxAdvanceBookingDays: null, cancelCutoffHours: null },
    ])
    replaceCategory.mockImplementation(async (categoryId, values) => ({
      categoryId,
      categoryName: "Goods",
      ...values,
    }))
    renderPage()

    const row = await screen.findByTestId("category-policy-c1")
    await user.type(row.querySelectorAll("input")[0], "9")
    await user.click(saveButton())

    await waitFor(() => expect(replaceCategory).toHaveBeenCalledTimes(1))
    expect(replacePolicy).not.toHaveBeenCalled()
  })

  it("shows the inherited value as the category placeholder", async () => {
    getPolicy.mockResolvedValue({
      cancellationPolicyText: null,
      maxActiveReservationsPerCustomerPerDay: null,
      maxAdvanceBookingDays: 7,
      cancelCutoffHours: 2,
    })
    getCategories.mockResolvedValue([
      { categoryId: "c1", categoryName: "Goods", maxAdvanceBookingDays: null, cancelCutoffHours: null },
    ])
    renderPage()

    const row = await screen.findByTestId("category-policy-c1")
    const [days, hours] = Array.from(row.querySelectorAll("input"))
    expect(days).toHaveAttribute("placeholder", i18n.t("rentals.bookingPolicy.categories.inherit", { value: "7" }))
    expect(hours).toHaveAttribute("placeholder", i18n.t("rentals.bookingPolicy.categories.inherit", { value: "2" }))
  })

  it("reports a partial failure by category name and keeps that row dirty", async () => {
    const user = userEvent.setup()
    getCategories.mockResolvedValue([
      { categoryId: "c1", categoryName: "Goods", maxAdvanceBookingDays: null, cancelCutoffHours: null },
      { categoryId: "c2", categoryName: "Other", maxAdvanceBookingDays: null, cancelCutoffHours: null },
    ])
    replaceCategory.mockImplementation(async (categoryId, values) => {
      if (categoryId === "c2") throw new Error("boom")
      return { categoryId, categoryName: "Goods", ...values }
    })
    renderPage()

    const first = await screen.findByTestId("category-policy-c1")
    const second = screen.getByTestId("category-policy-c2")
    await user.type(first.querySelectorAll("input")[0], "3")
    await user.type(second.querySelectorAll("input")[0], "4")
    await user.click(saveButton())

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        i18n.t("rentals.bookingPolicy.categories.saveFailed", { names: "Other" }),
      ),
    )
    expect(toastSuccess).not.toHaveBeenCalled()
    expect(second.querySelectorAll("input")[0]).toHaveValue("4")
    expect(saveButton()).toBeEnabled()
  })

  it("blocks Save while a category cell is not a whole number", async () => {
    const user = userEvent.setup()
    getCategories.mockResolvedValue([
      { categoryId: "c1", categoryName: "Goods", maxAdvanceBookingDays: null, cancelCutoffHours: null },
    ])
    renderPage()

    const row = await screen.findByTestId("category-policy-c1")
    await user.type(row.querySelectorAll("input")[0], "abc")
    expect(saveButton()).toBeDisabled()
    expect(screen.getByText(i18n.t("rentals.bookingPolicy.categories.invalid"))).toBeInTheDocument()
  })

  it("does not render its own timezone line (the Reservas header owns it)", async () => {
    renderPage()

    await screen.findByLabelText(t("horizonDays"))
    expect(screen.queryByTestId("tenant-tz-label")).not.toBeInTheDocument()
  })

  it("renders each rule as a sentence with a single input and an inline unlimited checkbox", async () => {
    getPolicy.mockResolvedValue({
      cancellationPolicyText: null,
      maxActiveReservationsPerCustomerPerDay: 2,
      maxAdvanceBookingDays: 7,
      cancelCutoffHours: null,
    })
    renderPage()

    await screen.findByLabelText(t("horizonDays"))
    expect(screen.getByLabelText(t("horizonDays"))).toHaveValue("7")
    expect(unlimitedBox("rule-horizon")).not.toBeChecked()
    expect(screen.getByTestId("rule-horizon")).toHaveTextContent(t("horizonBefore"))
    expect(screen.getByTestId("rule-horizon")).toHaveTextContent(t("horizonAfter"))
    expect(screen.getByLabelText(t("cancelCutoffHours"))).toBeDisabled()
    expect(unlimitedBox("rule-cancel-cutoff")).toBeChecked()
    expect(screen.getByLabelText(t("dailyLimitValue"))).toHaveValue("2")
    expect(unlimitedBox("rule-daily-limit")).not.toBeChecked()
    // No per-field helper copy, no always-open textarea.
    expect(screen.queryByText(i18n.t("rentals.bookingPolicy.validation.limitRange"))).not.toBeInTheDocument()
    expect(screen.queryByLabelText(t("cancellationLabel"))).not.toBeInTheDocument()
  })

  it("loads both fields and saves a full replacement", async () => {
    const user = userEvent.setup()
    renderPage()

    const text = await screen.findByLabelText(t("cancellationLabel"))
    expect(text).toHaveValue("Bring a document.")
    expect(text.tagName).toBe("TEXTAREA")
    expect(unlimitedBox("rule-daily-limit")).not.toBeChecked()
    expect(screen.getByLabelText(t("dailyLimitValue"))).toHaveValue("3")

    await user.clear(text)
    await user.type(text, "<b>See you there.</b>")
    await user.clear(screen.getByLabelText(t("dailyLimitValue")))
    await user.type(screen.getByLabelText(t("dailyLimitValue")), "2")
    await user.click(saveButton())

    await waitFor(() => {
      expect(replacePolicy).toHaveBeenCalledWith({
        cancellationPolicyText: "<b>See you there.</b>",
        maxActiveReservationsPerCustomerPerDay: 2,
      })
    })
    expect(toastSuccess).toHaveBeenCalledWith(t("saved"))
    expect(text).toHaveValue("<b>See you there.</b>")
  })

  it("keeps the cancellation text behind a button and counts characters only while focused", async () => {
    const user = userEvent.setup()
    getPolicy.mockResolvedValue({
      cancellationPolicyText: null,
      maxActiveReservationsPerCustomerPerDay: null,
    })
    renderPage()

    await user.click(await screen.findByRole("button", { name: t("addCancellationText") }))
    const text = screen.getByLabelText(t("cancellationLabel"))
    expect(screen.queryByText(/\/2000$/)).not.toBeInTheDocument()
    await user.click(text)
    await user.type(text, "abc")
    expect(screen.getByText("3/2000")).toBeInTheDocument()
    await user.tab()
    expect(screen.queryByText(/\/2000$/)).not.toBeInTheDocument()
  })

  it("sends null for blank text and an unlimited day", async () => {
    const user = userEvent.setup()
    renderPage()

    const text = await screen.findByLabelText(t("cancellationLabel"))
    await user.clear(text)
    await user.click(unlimitedBox("rule-daily-limit"))
    await user.click(saveButton())

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

    await screen.findByLabelText(t("dailyLimitValue"))
    await user.click(unlimitedBox("rule-daily-limit"))

    expect(saveButton()).toBeDisabled()

    const limit = screen.getByLabelText(t("dailyLimitValue"))
    await user.type(limit, "101")
    expect(saveButton()).toBeDisabled()
    expect(screen.getByText(t("validation.limitRange"))).toBeInTheDocument()
    expect(replacePolicy).not.toHaveBeenCalled()

    await user.clear(limit)
    await user.type(limit, "1")
    expect(saveButton()).toBeEnabled()
  })

  it("keeps the form and re-enables save when the API rejects the replacement", async () => {
    const user = userEvent.setup()
    replacePolicy.mockRejectedValue(
      new Error("Cancellation policy text must be at most 2000 characters."),
    )
    renderPage()

    const text = await screen.findByLabelText(t("cancellationLabel"))
    await user.type(text, "!")
    await user.click(saveButton())

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith(
        "Cancellation policy text must be at most 2000 characters.",
      )
    })
    expect(text).toHaveValue("Bring a document.!")
    expect(saveButton()).toBeEnabled()
  })

  it("hides save without write permission and shows the loaded text", async () => {
    renderPage(["rentals.booking_policy.read"])

    const text = await screen.findByLabelText(t("cancellationLabel"))
    expect(text).toBeDisabled()
    expect(text).toHaveValue("Bring a document.")
    expect(unlimitedBox("rule-horizon")).toBeDisabled()
    expect(screen.queryByRole("button", { name: t("save") })).not.toBeInTheDocument()
    expect(screen.getByText(t("readOnly"))).toBeInTheDocument()
  })

  it("disables a loaded horizon when the user can only read", async () => {
    getPolicy.mockResolvedValue({
      cancellationPolicyText: "Bring a document.",
      maxActiveReservationsPerCustomerPerDay: null,
      maxAdvanceBookingDays: 12,
    })
    renderPage(["rentals.booking_policy.read"])

    const days = await screen.findByLabelText(t("horizonDays"))
    expect(days).toBeDisabled()
    expect(days).toHaveValue("12")
    expect(unlimitedBox("rule-horizon")).toBeDisabled()
  })

  it("hides save when the trial is read-only", async () => {
    trial.readOnly = true
    renderPage()

    await screen.findByLabelText(t("cancellationLabel"))
    expect(screen.queryByRole("button", { name: t("save") })).not.toBeInTheDocument()
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
    await user.click(screen.getByRole("button", { name: i18n.t("common.retry") }))

    expect(await screen.findByLabelText(t("cancellationLabel"))).toHaveValue("After retry")
  })

  it("omits the horizon when the loaded value did not change", async () => {
    const user = userEvent.setup()
    getPolicy.mockResolvedValue({
      cancellationPolicyText: "Bring a document.",
      maxActiveReservationsPerCustomerPerDay: 3,
      maxAdvanceBookingDays: 30,
    })
    renderPage()

    const text = await screen.findByLabelText(t("cancellationLabel"))
    expect(screen.getByLabelText(t("horizonDays"))).toHaveValue("30")
    await user.type(text, "!")
    await user.click(saveButton())

    await waitFor(() => {
      expect(replacePolicy).toHaveBeenCalled()
    })
    expect(replacePolicy.mock.calls[0]?.[0]).not.toHaveProperty("maxAdvanceBookingDays")
  })

  it("sends null when the horizon changes to unlimited", async () => {
    const user = userEvent.setup()
    getPolicy.mockResolvedValue({
      cancellationPolicyText: null,
      maxActiveReservationsPerCustomerPerDay: null,
      maxAdvanceBookingDays: 30,
    })
    renderPage()

    await screen.findByLabelText(t("horizonDays"))
    await user.click(unlimitedBox("rule-horizon"))
    await user.click(saveButton())

    await waitFor(() => {
      expect(replacePolicy).toHaveBeenCalledWith({
        cancellationPolicyText: null,
        maxActiveReservationsPerCustomerPerDay: null,
        maxAdvanceBookingDays: null,
      })
    })
  })

  it("sends a number when a horizon is set and blocks values outside 0..3650", async () => {
    const user = userEvent.setup()
    getPolicy.mockResolvedValue({
      cancellationPolicyText: null,
      maxActiveReservationsPerCustomerPerDay: null,
      maxAdvanceBookingDays: null,
    })
    renderPage()

    await screen.findByLabelText(t("horizonDays"))
    await user.click(unlimitedBox("rule-horizon"))

    const days = screen.getByLabelText(t("horizonDays"))
    expect(saveButton()).toBeDisabled()

    await user.type(days, "3651")
    expect(saveButton()).toBeDisabled()
    expect(replacePolicy).not.toHaveBeenCalled()

    await user.clear(days)
    await user.type(days, "0")
    expect(saveButton()).toBeEnabled()

    await user.clear(days)
    await user.type(days, "3650")
    expect(saveButton()).toBeEnabled()

    await user.clear(days)
    await user.type(days, "14")
    await user.click(saveButton())

    await waitFor(() => {
      expect(replacePolicy).toHaveBeenCalledWith({
        cancellationPolicyText: null,
        maxActiveReservationsPerCustomerPerDay: null,
        maxAdvanceBookingDays: 14,
      })
    })
  })

  it("sends null when the cancelCutoff changes to no deadline", async () => {
    const user = userEvent.setup()
    getPolicy.mockResolvedValue({
      cancellationPolicyText: null,
      maxActiveReservationsPerCustomerPerDay: null,
      cancelCutoffHours: 30,
    })
    renderPage()

    expect(await screen.findByLabelText(t("cancelCutoffHours"))).toHaveValue("30")
    await user.click(unlimitedBox("rule-cancel-cutoff"))
    await user.click(saveButton())

    await waitFor(() => {
      expect(replacePolicy).toHaveBeenCalledWith({
        cancellationPolicyText: null,
        maxActiveReservationsPerCustomerPerDay: null,
        cancelCutoffHours: null,
      })
    })
  })

  it("sends a number when a cancelCutoff is set and blocks values outside 0..8760", async () => {
    const user = userEvent.setup()
    getPolicy.mockResolvedValue({
      cancellationPolicyText: null,
      maxActiveReservationsPerCustomerPerDay: null,
      cancelCutoffHours: null,
    })
    renderPage()

    await screen.findByLabelText(t("cancelCutoffHours"))
    await user.click(unlimitedBox("rule-cancel-cutoff"))

    const hours = screen.getByLabelText(t("cancelCutoffHours"))
    expect(saveButton()).toBeDisabled()

    await user.type(hours, "8761")
    expect(saveButton()).toBeDisabled()
    expect(replacePolicy).not.toHaveBeenCalled()

    await user.clear(hours)
    await user.type(hours, "0")
    expect(saveButton()).toBeEnabled()

    await user.clear(hours)
    await user.type(hours, "8760")
    expect(saveButton()).toBeEnabled()

    await user.clear(hours)
    await user.type(hours, "14")
    await user.click(saveButton())

    await waitFor(() => {
      expect(replacePolicy).toHaveBeenCalledWith({
        cancellationPolicyText: null,
        maxActiveReservationsPerCustomerPerDay: null,
        cancelCutoffHours: 14,
      })
    })
  })
})
