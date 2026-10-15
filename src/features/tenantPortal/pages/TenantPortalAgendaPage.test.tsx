import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { MemoryRouter, Outlet, Route, Routes } from "react-router-dom"

import { formatMoney } from "@/features/rentals/services/reservationsService"
import { brazilTodayIsoDate } from "@/lib/brazilTimeZone"
import enCommon from "@/locales/en/common.json"
import esCommon from "@/locales/es/common.json"
import ptBRCommon from "@/locales/pt-BR/common.json"
import i18n from "@/lib/i18n"
import type { CustomerAppOutletContext } from "@/features/tenantPortal/components/CustomerAppLayout"
import type {
  PortalRentalAsset,
  PortalReservation,
  PortalScheduleSlot,
  ReservationQueueStatus,
} from "@/features/tenantPortal/services/tenantPortalService"

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock("@/features/rentals/services/rentalLayoutService", () => ({
  fetchPublicRentalLayouts: vi.fn(),
}))

vi.mock("@/features/rentals/services/bookingPolicyService", () => ({
  fetchPublicBookingPolicy: vi.fn(),
}))

vi.mock("@/features/tenantPortal/services/tenantPortalService", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@/features/tenantPortal/services/tenantPortalService")
    >()
  return {
    ...actual,
    getCustomerAccessToken: vi.fn(() => "test-customer-token"),
    isCustomerSignedInForTenant: vi.fn(() => true),
    fetchPortalRentalAssets: vi.fn(),
    listMyPortalReservations: vi.fn(),
    fetchPublicScheduleDay: vi.fn(),
    cancelMyPortalReservation: vi.fn(),
    bookPortalSlot: vi.fn(),
    checkPortalAvailability: vi.fn(),
    createPortalReservation: vi.fn(),
    fetchReservationQueue: vi.fn(),
    joinReservationQueue: vi.fn(),
  }
})

import { toast } from "sonner"
import { fetchPublicRentalLayouts } from "@/features/rentals/services/rentalLayoutService"
import { fetchPublicBookingPolicy } from "@/features/rentals/services/bookingPolicyService"
import { TenantPortalAgendaPage } from "@/features/tenantPortal/pages/TenantPortalAgendaPage"
import { PortalBookingError } from "@/features/tenantPortal/lib/portalBookingError"
import {
  bookPortalSlot,
  cancelMyPortalReservation,
  checkPortalAvailability,
  createPortalReservation,
  fetchPortalRentalAssets,
  fetchPublicScheduleDay,
  fetchReservationQueue,
  joinReservationQueue,
  listMyPortalReservations,
} from "@/features/tenantPortal/services/tenantPortalService"

const RESERVATION_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const FUTURE_ISO = "2099-01-15T13:00:00.000Z"
const PAST_ISO = "2020-01-15T13:00:00.000Z"

const listMine = vi.mocked(listMyPortalReservations)
const fetchAssets = vi.mocked(fetchPortalRentalAssets)
const fetchLayouts = vi.mocked(fetchPublicRentalLayouts)
const fetchDay = vi.mocked(fetchPublicScheduleDay)
const cancelMine = vi.mocked(cancelMyPortalReservation)
const checkAvailability = vi.mocked(checkPortalAvailability)
const bookSlot = vi.mocked(bookPortalSlot)
const createReservation = vi.mocked(createPortalReservation)
const fetchQueue = vi.mocked(fetchReservationQueue)
const joinQueue = vi.mocked(joinReservationQueue)
const fetchPolicy = vi.mocked(fetchPublicBookingPolicy)
const toastSuccess = vi.mocked(toast.success)
const toastError = vi.mocked(toast.error)

const outletContext: CustomerAppOutletContext = {
  subdomain: "ficc",
  branding: {
    subdomain: "ficc",
    displayName: "FICC",
    logoSvg: null,
    primaryColor: "#123456",
    accentColor: null,
    welcomeTagline: null,
  },
  primary: "#123456",
  menu: [],
}

function makeReservation(
  status: string,
  startDateTime: string,
  overrides: Partial<PortalReservation> = {},
): PortalReservation {
  return {
    id: RESERVATION_ID,
    tenantId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    unitId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    customerId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    customerName: "Ana Souza",
    customerWhatsApp: "+5511999999999",
    startDateTime,
    endDateTime: "2099-01-15T14:00:00.000Z",
    status,
    totalAmount: 80,
    depositPaid: 0,
    createdAt: "2026-09-06T12:00:00.000Z",
    items: [
      {
        id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
        assetId: "ffffffff-ffff-4fff-8fff-ffffffffffff",
        rentalAssetId: "11111111-1111-4111-8111-111111111111",
        assetName: "Quadra 1",
        quantity: 1,
        unitPrice: 80,
        subTotal: 80,
      },
    ],
    ...overrides,
  }
}

function renderAgenda(initialEntry = "/agenda") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route element={<Outlet context={outletContext} />}>
          <Route path="/agenda" element={<TenantPortalAgendaPage />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

function cancelButton() {
  return screen.queryByRole("button", {
    name: i18n.t("tenantPortal.agenda.cancel"),
  })
}

async function openCancelDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    screen.getByRole("button", {
      name: i18n.t("tenantPortal.agenda.cancel"),
    }),
  )
  return screen.findByRole("alertdialog")
}

async function confirmCancel(user: ReturnType<typeof userEvent.setup>) {
  const dialog = await openCancelDialog(user)
  await user.click(
    within(dialog).getByRole("button", {
      name: i18n.t("tenantPortal.agenda.cancelConfirmAction"),
    }),
  )
  return dialog
}

function completeButton() {
  return screen.queryByRole("button", {
    name: i18n.t("rentals.reservations.complete"),
  })
}

async function waitForMineList() {
  expect(
    await screen.findByText(i18n.t("tenantPortal.agenda.myReservations")),
  ).toBeInTheDocument()
  const row = (await screen.findByText("Quadra 1")).closest("li")
  expect(row).toHaveTextContent(formatMoney(80))
  expect(row).toHaveTextContent(
    i18n.t("tenantPortal.agenda.total", { amount: formatMoney(80) }),
  )
}

describe("TenantPortalAgendaPage B2C self-cancel", () => {
  beforeEach(() => {
    listMine.mockReset()
    fetchAssets.mockReset()
    fetchLayouts.mockReset()
    fetchDay.mockReset()
    cancelMine.mockReset()
    checkAvailability.mockReset()
    bookSlot.mockReset()
    fetchQueue.mockReset()
    joinQueue.mockReset()
    createReservation.mockReset()
    fetchPolicy.mockReset()
    toastSuccess.mockReset()
    toastError.mockReset()
    fetchPolicy.mockResolvedValue({
      cancellationPolicyText: null,
      maxActiveReservationsPerCustomerPerDay: null,
    })
    checkAvailability.mockResolvedValue({
      isAvailable: true,
      requestedQuantity: 1,
      availableQuantity: 1,
      estimatedTotalAmount: 80,
      reason: null,
    })

    fetchAssets.mockResolvedValue([])
    fetchLayouts.mockResolvedValue([])
    fetchDay.mockResolvedValue({ date: "2026-09-08", slots: [] })
    listMine.mockResolvedValue([])
  })

  it("shows Cancelar for a future PendingDeposit reservation", async () => {
    listMine.mockResolvedValue([makeReservation("PendingDeposit", FUTURE_ISO)])
    renderAgenda()
    await waitForMineList()

    expect(cancelButton()).toBeInTheDocument()
    expect(completeButton()).not.toBeInTheDocument()
  })

  it("shows Cancelar for a future Confirmed reservation", async () => {
    listMine.mockResolvedValue([makeReservation("Confirmed", FUTURE_ISO)])
    renderAgenda()
    await waitForMineList()

    expect(cancelButton()).toBeInTheDocument()
    expect(completeButton()).not.toBeInTheDocument()
  })

  it("hides Cancelar for Completed", async () => {
    listMine.mockResolvedValue([makeReservation("Completed", FUTURE_ISO)])
    renderAgenda()
    await waitForMineList()

    expect(cancelButton()).not.toBeInTheDocument()
    expect(completeButton()).not.toBeInTheDocument()
  })

  it("hides Cancelar for a started or past Confirmed reservation", async () => {
    listMine.mockResolvedValue([makeReservation("Confirmed", PAST_ISO)])
    renderAgenda()
    await waitForMineList()

    expect(cancelButton()).not.toBeInTheDocument()
    expect(completeButton()).not.toBeInTheDocument()
    expect(
      screen.queryByText(i18n.t("tenantPortal.agenda.pastReservation")),
    ).not.toBeInTheDocument()
  })

  it("labels an ended reservation as past and hides cancel", async () => {
    listMine.mockResolvedValue([
      makeReservation("Confirmed", PAST_ISO, {
        endDateTime: "2020-01-15T14:00:00.000Z",
      }),
    ])
    renderAgenda()
    await waitForMineList()

    expect(
      screen.getByText(i18n.t("tenantPortal.agenda.pastReservation")),
    ).toBeInTheDocument()
    expect(cancelButton()).not.toBeInTheDocument()
  })

  it("hides Cancelar for Canceled", async () => {
    listMine.mockResolvedValue([makeReservation("Canceled", FUTURE_ISO)])
    renderAgenda()
    await waitForMineList()

    expect(cancelButton()).not.toBeInTheDocument()
    expect(completeButton()).not.toBeInTheDocument()
  })

  it("cancels, toasts success, and refetches mine plus the schedule day", async () => {
    const user = userEvent.setup()
    const confirmed = makeReservation("Confirmed", FUTURE_ISO)
    const canceled = makeReservation("Canceled", FUTURE_ISO)
    let rows: PortalReservation[] = [confirmed]

    listMine.mockImplementation(async () => rows)
    cancelMine.mockImplementation(async () => {
      rows = [canceled]
      return canceled
    })

    renderAgenda()
    await waitForMineList()
    expect(cancelButton()).toBeInTheDocument()

    await confirmCancel(user)

    await waitFor(() => {
      expect(cancelMine).toHaveBeenCalledWith(RESERVATION_ID)
    })
    expect(toastSuccess).toHaveBeenCalledWith(
      i18n.t("tenantPortal.agenda.cancelSuccess"),
    )
    await waitFor(() => {
      expect(listMine.mock.calls.length).toBeGreaterThanOrEqual(2)
    })
    await waitFor(() => {
      expect(fetchDay.mock.calls.length).toBeGreaterThanOrEqual(2)
    })
    expect(cancelButton()).not.toBeInTheDocument()
    expect(completeButton()).not.toBeInTheDocument()
    expect(screen.getByText(/Cancelada/)).toBeInTheDocument()
  })

  it("surfaces an API conflict, stays on the page, and refetches mine", async () => {
    const user = userEvent.setup()
    const confirmed = makeReservation("Confirmed", FUTURE_ISO)
    const completed = makeReservation("Completed", PAST_ISO)
    let rows: PortalReservation[] = [confirmed]

    listMine.mockImplementation(async () => rows)
    cancelMine.mockImplementation(async () => {
      rows = [completed]
      throw new Error("Cannot cancel a reservation that has already started.")
    })

    renderAgenda()
    await waitForMineList()

    await confirmCancel(user)

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith(
        "Cannot cancel a reservation that has already started.",
      )
    })
    expect(toastSuccess).not.toHaveBeenCalled()
    expect(
      screen.getByText(i18n.t("tenantPortal.agenda.myReservations")),
    ).toBeInTheDocument()
    await waitFor(() => {
      expect(listMine.mock.calls.length).toBeGreaterThanOrEqual(2)
    })
    await waitFor(() => {
      expect(cancelButton()).not.toBeInTheDocument()
    })
    expect(completeButton()).not.toBeInTheDocument()
  })

  it("explains the deposit and refund consequence before calling cancel", async () => {
    const user = userEvent.setup()
    listMine.mockResolvedValue([makeReservation("Confirmed", FUTURE_ISO)])
    renderAgenda()
    await waitForMineList()

    const dialog = await openCancelDialog(user)

    expect(cancelMine).not.toHaveBeenCalled()
    expect(
      within(dialog).getByText(i18n.t("tenantPortal.agenda.cancelConfirmBody")),
    ).toBeInTheDocument()

    await user.click(
      within(dialog).getByRole("button", {
        name: i18n.t("tenantPortal.agenda.cancelConfirmDismiss"),
      }),
    )

    await waitFor(() => {
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
    })
    expect(cancelMine).not.toHaveBeenCalled()
  })

  it("shows the same payment note before canceling a pending deposit", async () => {
    const user = userEvent.setup()
    listMine.mockResolvedValue([makeReservation("PendingDeposit", FUTURE_ISO)])
    renderAgenda()
    await waitForMineList()

    const dialog = await openCancelDialog(user)

    expect(
      within(dialog).getByText(i18n.t("tenantPortal.agenda.cancelConfirmBody")),
    ).toBeInTheDocument()
    expect(cancelMine).not.toHaveBeenCalled()
  })

  it("shows the tenant cancellation text as plain text beside the existing note", async () => {
    const user = userEvent.setup()
    const policyText = '<img src=x onerror="alert(1)"><script>alert(1)</script>'
    fetchPolicy.mockResolvedValue({
      cancellationPolicyText: `  ${policyText}\nLine 2  `,
      maxActiveReservationsPerCustomerPerDay: 2,
    })
    listMine.mockResolvedValue([makeReservation("Confirmed", FUTURE_ISO)])
    renderAgenda()
    await waitForMineList()

    const dialog = await openCancelDialog(user)

    expect(
      within(dialog).getByText(i18n.t("tenantPortal.agenda.cancelConfirmBody")),
    ).toBeInTheDocument()
    const policy = within(dialog).getByTestId("cancellation-policy-text")
    expect(policy).toHaveTextContent(`${policyText} Line 2`)
    expect(policy.innerHTML).not.toContain("<img")
    expect(policy.innerHTML).not.toContain("<script")
    expect(policy.querySelector("img")).toBeNull()
    expect(policy.querySelector("script")).toBeNull()
  })

  it("keeps only the existing note when the tenant has no cancellation text", async () => {
    const user = userEvent.setup()
    fetchPolicy.mockResolvedValue({
      cancellationPolicyText: "   ",
      maxActiveReservationsPerCustomerPerDay: null,
    })
    listMine.mockResolvedValue([makeReservation("Confirmed", FUTURE_ISO)])
    renderAgenda()
    await waitForMineList()

    const dialog = await openCancelDialog(user)

    expect(
      within(dialog).getByText(i18n.t("tenantPortal.agenda.cancelConfirmBody")),
    ).toBeInTheDocument()
    expect(
      within(dialog).queryByTestId("cancellation-policy-text"),
    ).not.toBeInTheDocument()
  })

  it("keeps only the existing note when the public policy request fails", async () => {
    const user = userEvent.setup()
    fetchPolicy.mockRejectedValue(new Error("policy down"))
    listMine.mockResolvedValue([makeReservation("Confirmed", FUTURE_ISO)])
    renderAgenda()
    await waitForMineList()

    const dialog = await openCancelDialog(user)

    expect(
      within(dialog).getByText(i18n.t("tenantPortal.agenda.cancelConfirmBody")),
    ).toBeInTheDocument()
    expect(
      within(dialog).queryByTestId("cancellation-policy-text"),
    ).not.toBeInTheDocument()
    expect(toastError).not.toHaveBeenCalledWith("policy down")
  })

  it("clears Cancelando and shows the canceled reservation before refresh settles", async () => {
    const user = userEvent.setup()
    const canceled = makeReservation("Canceled", FUTURE_ISO)
    let listCalls = 0
    listMine.mockImplementation(() => {
      listCalls += 1
      if (listCalls === 1) {
        return Promise.resolve([makeReservation("Confirmed", FUTURE_ISO)])
      }
      return new Promise(() => {})
    })
    let dayCalls = 0
    fetchDay.mockImplementation(() => {
      dayCalls += 1
      if (dayCalls === 1) {
        return Promise.resolve({ date: "2026-09-08", slots: [] })
      }
      return new Promise(() => {})
    })
    cancelMine.mockResolvedValue(canceled)

    renderAgenda()
    await waitForMineList()
    await confirmCancel(user)

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith(
        i18n.t("tenantPortal.agenda.cancelSuccess"),
      )
    })
    expect(
      screen.queryByRole("button", {
        name: i18n.t("tenantPortal.agenda.cancelling"),
      }),
    ).not.toBeInTheDocument()
    expect(screen.getByText(/Cancelada/)).toBeInTheDocument()
    expect(cancelButton()).not.toBeInTheDocument()
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
  })

  it("clears Cancelando and toasts when cancel fails even if refetch hangs", async () => {
    const user = userEvent.setup()
    let listCalls = 0
    listMine.mockImplementation(() => {
      listCalls += 1
      if (listCalls === 1) {
        return Promise.resolve([makeReservation("Confirmed", FUTURE_ISO)])
      }
      return new Promise(() => {})
    })
    cancelMine.mockRejectedValue(
      new Error("Cannot cancel a reservation that has already started."),
    )

    renderAgenda()
    await waitForMineList()
    await confirmCancel(user)

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith(
        "Cannot cancel a reservation that has already started.",
      )
    })
    expect(toastSuccess).not.toHaveBeenCalled()
    expect(
      screen.queryByRole("button", {
        name: i18n.t("tenantPortal.agenda.cancelling"),
      }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole("button", {
        name: i18n.t("tenantPortal.agenda.cancelConfirmAction"),
      }),
    ).toBeEnabled()
  })
})

const ASSET_A_ID = "11111111-1111-4111-8111-111111111111"
const ASSET_B_ID = "22222222-2222-4222-8222-222222222222"
const ASSET_A_ASSET_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01"
const ASSET_B_ASSET_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa02"

function makeAsset(id: string, assetId: string, name: string): PortalRentalAsset {
  return {
    id,
    assetId,
    tenantId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    unitId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    name,
    type: "Location",
    totalQuantity: 1,
    isActive: true,
    requiresDeposit: true,
    queueEnabled: false,
    queueOpeningTime: null,
    schedulePolicy: "SlotGrid",
    createdAt: "2026-09-06T12:00:00.000Z",
  }
}

function makeSlot(
  overrides: Pick<
    PortalScheduleSlot,
    "id" | "rentalAssetId" | "assetName" | "startTime" | "endTime"
  > &
    Partial<PortalScheduleSlot>,
): PortalScheduleSlot {
  return {
    occupancyKindId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    occupancyKindKey: "open",
    occupancyKindLabel: "Aberto",
    occupancyKindColorHex: null,
    isBookableByCustomer: true,
    label: null,
    status: "available",
    reservationId: null,
    isDerived: false,
    date: "2026-09-12",
    ...overrides,
  }
}

describe("TenantPortalAgendaPage time selector", () => {
  beforeEach(() => {
    vi.useFakeTimers({
      toFake: ["Date"],
      now: new Date("2026-10-14T08:00:00.000Z"),
    })
    listMine.mockReset()
    fetchAssets.mockReset()
    fetchLayouts.mockReset()
    fetchDay.mockReset()
    cancelMine.mockReset()
    checkAvailability.mockReset()
    bookSlot.mockReset()
    fetchQueue.mockReset()
    joinQueue.mockReset()
    createReservation.mockReset()
    fetchPolicy.mockReset()
    toastSuccess.mockReset()
    toastError.mockReset()
    fetchPolicy.mockResolvedValue({
      cancellationPolicyText: null,
      maxActiveReservationsPerCustomerPerDay: null,
    })
    checkAvailability.mockResolvedValue({
      isAvailable: true,
      requestedQuantity: 1,
      availableQuantity: 1,
      estimatedTotalAmount: 80,
      reason: null,
    })

    listMine.mockResolvedValue([])
    fetchLayouts.mockResolvedValue([])
    fetchAssets.mockResolvedValue([
      makeAsset(ASSET_A_ID, ASSET_A_ASSET_ID, "Quadra 1"),
      makeAsset(ASSET_B_ID, ASSET_B_ASSET_ID, "Quadra 2"),
    ])
    fetchDay.mockResolvedValue({
      date: "2026-09-12",
      slots: [
        makeSlot({
          id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1",
          rentalAssetId: ASSET_A_ID,
          assetName: "Quadra 1",
          startTime: "08:00:00",
          endTime: "09:00:00",
        }),
        makeSlot({
          id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2",
          rentalAssetId: ASSET_B_ID,
          assetName: "Quadra 2",
          startTime: "09:00:00",
          endTime: "10:00:00",
        }),
      ],
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("renders the accessible select with themed popup classes", async () => {
    const user = userEvent.setup()
    renderAgenda()

    const trigger = await screen.findByRole("combobox", {
      name: i18n.t("tenantPortal.agenda.time"),
    })
    expect(trigger).toBeEnabled()
    expect(trigger).toHaveAttribute("data-slot", "select-trigger")

    await user.click(trigger)
    const option = await screen.findByRole("option", { name: "09:00 – 10:00" })
    const popup = option.closest("[data-slot='select-content']")
    expect(popup).toHaveClass("bg-popover")
    expect(popup).toHaveClass("text-popover-foreground")
  })

  it("selects a later time and keeps unavailable courts distinguishable", async () => {
    const user = userEvent.setup()
    renderAgenda()

    const courtOne = await screen.findByRole("button", { name: "Quadra 1" })
    const courtTwo = await screen.findByRole("button", {
      name: `Quadra 2. ${i18n.t("tenantPortal.agenda.unavailable")}`,
    })
    expect(courtOne).not.toHaveAttribute("aria-disabled")
    expect(courtTwo).toHaveAttribute("aria-disabled", "true")
    expect(courtTwo).toHaveTextContent(i18n.t("tenantPortal.agenda.unavailable"))

    await user.click(
      screen.getByRole("combobox", {
        name: i18n.t("tenantPortal.agenda.time"),
      }),
    )
    await user.click(
      await screen.findByRole("option", { name: "09:00 – 10:00" }),
    )

    await waitFor(() => {
      expect(courtTwo).not.toHaveAttribute("aria-disabled")
    })
    expect(courtOne).toHaveAttribute("aria-disabled", "true")
  })

  it("disables the time selector when the day has no bookable slots", async () => {
    fetchDay.mockResolvedValue({ date: "2026-09-12", slots: [] })
    renderAgenda()

    const trigger = await screen.findByRole("combobox", {
      name: i18n.t("tenantPortal.agenda.time"),
    })
    await waitFor(() => {
      expect(trigger).toBeDisabled()
    })
    expect(trigger).toHaveTextContent(i18n.t("tenantPortal.agenda.noTimes"))
  })

  it("shows a loading state instead of the empty copy while slots are in flight", async () => {
    let resolveDay: (value: { date: string; slots: PortalScheduleSlot[] }) => void =
      () => {}
    fetchDay.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveDay = resolve
        }),
    )
    renderAgenda()

    const trigger = await screen.findByRole("combobox", {
      name: i18n.t("tenantPortal.agenda.time"),
    })
    expect(trigger).toHaveTextContent(i18n.t("tenantPortal.agenda.loadingTimes"))
    expect(trigger).not.toHaveTextContent(i18n.t("tenantPortal.agenda.noTimes"))

    resolveDay({ date: "2026-09-12", slots: [] })

    await waitFor(() => {
      expect(trigger).toHaveTextContent(i18n.t("tenantPortal.agenda.noTimes"))
    })
    expect(trigger).not.toHaveTextContent(
      i18n.t("tenantPortal.agenda.loadingTimes"),
    )
  })

  it("shows an error state instead of the empty copy when the request fails", async () => {
    fetchDay.mockRejectedValue(new Error("network"))
    renderAgenda()

    const trigger = await screen.findByRole("combobox", {
      name: i18n.t("tenantPortal.agenda.time"),
    })
    await waitFor(() => {
      expect(trigger).toHaveTextContent(i18n.t("tenantPortal.agenda.slotsError"))
    })
    expect(trigger).not.toHaveTextContent(i18n.t("tenantPortal.agenda.noTimes"))
  })

  it("shows the estimate and the deposit note before booking a deposit court", async () => {
    const user = userEvent.setup()
    renderAgenda()

    await user.click(await screen.findByRole("button", { name: "Quadra 1" }))

    expect(
      await screen.findByText(
        i18n.t("tenantPortal.agenda.available", {
          amount: formatMoney(80),
        }),
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByText(i18n.t("tenantPortal.agenda.depositRequired")),
    ).toBeInTheDocument()
    expect(checkAvailability).toHaveBeenCalledWith(
      "ficc",
      expect.objectContaining({
        assetId: ASSET_A_ASSET_ID,
        startTime: "08:00",
        endTime: "09:00",
        quantity: 1,
      }),
    )
  })

  it("shows the estimate without a deposit note when the court does not require one", async () => {
    const user = userEvent.setup()
    fetchAssets.mockResolvedValue([
      {
        ...makeAsset(ASSET_B_ID, ASSET_B_ASSET_ID, "Quadra 2"),
        requiresDeposit: false,
      },
    ])
    fetchDay.mockResolvedValue({
      date: "2026-09-12",
      slots: [
        makeSlot({
          id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2",
          rentalAssetId: ASSET_B_ID,
          assetName: "Quadra 2",
          startTime: "19:00:00",
          endTime: "20:00:00",
        }),
      ],
    })
    renderAgenda()

    await user.click(await screen.findByRole("button", { name: "Quadra 2" }))

    expect(
      await screen.findByText(
        i18n.t("tenantPortal.agenda.available", {
          amount: formatMoney(80),
        }),
      ),
    ).toBeInTheDocument()
    expect(
      screen.queryByText(i18n.t("tenantPortal.agenda.depositRequired")),
    ).not.toBeInTheDocument()
  })

  it("toasts the booked total and status", async () => {
    const user = userEvent.setup()
    bookSlot.mockResolvedValue(makeReservation("Confirmed", FUTURE_ISO))
    renderAgenda()

    await user.click(await screen.findByRole("button", { name: "Quadra 1" }))
    await screen.findByText(
      i18n.t("tenantPortal.agenda.available", {
        amount: formatMoney(80),
      }),
    )
    await user.click(
      screen.getByRole("button", {
        name: i18n.t("tenantPortal.agenda.reserveSlot"),
      }),
    )

    await waitFor(() => {
      expect(bookSlot).toHaveBeenCalled()
    })
    expect(toastSuccess).toHaveBeenCalledWith(
      i18n.t("tenantPortal.agenda.reserveSuccessWithTotal", {
        amount: formatMoney(80),
        status: i18n.t("rentals.reservations.statuses.Confirmed"),
      }),
    )
  })

  async function bookQuadra1(user: ReturnType<typeof userEvent.setup>) {
    await user.click(await screen.findByRole("button", { name: "Quadra 1" }))
    await screen.findByText(
      i18n.t("tenantPortal.agenda.available", {
        amount: formatMoney(80),
      }),
    )
    await user.click(
      screen.getByRole("button", {
        name: i18n.t("tenantPortal.agenda.reserveSlot"),
      }),
    )
  }

  it("clears Reservando and shows the reservation before the refresh settles", async () => {
    const user = userEvent.setup()
    const created = makeReservation("Confirmed", FUTURE_ISO, {
      items: [
        {
          id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
          assetId: ASSET_A_ASSET_ID,
          rentalAssetId: ASSET_A_ID,
          assetName: "Quadra 1",
          quantity: 1,
          unitPrice: 80,
          subTotal: 80,
        },
      ],
    })
    let dayCalls = 0
    fetchDay.mockImplementation(() => {
      dayCalls += 1
      if (dayCalls === 1) {
        return Promise.resolve({
          date: "2026-09-12",
          slots: [
            makeSlot({
              id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1",
              rentalAssetId: ASSET_A_ID,
              assetName: "Quadra 1",
              startTime: "08:00:00",
              endTime: "09:00:00",
            }),
          ],
        })
      }
      return new Promise(() => {})
    })
    let listCalls = 0
    listMine.mockImplementation(() => {
      listCalls += 1
      if (listCalls === 1) {
        return Promise.resolve([])
      }
      return new Promise(() => {})
    })
    bookSlot.mockResolvedValue(created)
    renderAgenda()

    await bookQuadra1(user)

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith(
        i18n.t("tenantPortal.agenda.reserveSuccessWithTotal", {
          amount: formatMoney(80),
          status: i18n.t("rentals.reservations.statuses.Confirmed"),
        }),
      )
    })
    expect(
      screen.queryByRole("button", {
        name: i18n.t("tenantPortal.agenda.reserving"),
      }),
    ).not.toBeInTheDocument()
    const row = screen.getByRole("listitem")
    expect(row).toHaveTextContent("Quadra 1")
    expect(row).toHaveTextContent(
      i18n.t("rentals.reservations.statuses.Confirmed"),
    )
    expect(
      screen.getByRole("button", {
        name: `Quadra 1. ${i18n.t("tenantPortal.agenda.slotReserved")}`,
      }),
    ).toHaveAttribute("aria-disabled", "true")
  })

  it("clears Reservando and toasts when booking fails", async () => {
    const user = userEvent.setup()
    bookSlot.mockRejectedValue(new Error("slot taken"))
    renderAgenda()

    await bookQuadra1(user)

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith("slot taken")
    })
    expect(toastSuccess).not.toHaveBeenCalled()
    const reserve = screen.getByRole("button", {
      name: i18n.t("tenantPortal.agenda.reserveSlot"),
    })
    expect(reserve).not.toHaveAttribute("aria-busy", "true")
    expect(reserve).toBeEnabled()
  })

  it("keeps the success toast when the follow-up refresh fails", async () => {
    const user = userEvent.setup()
    let dayCalls = 0
    fetchDay.mockImplementation(() => {
      dayCalls += 1
      if (dayCalls === 1) {
        return Promise.resolve({
          date: "2026-09-12",
          slots: [
            makeSlot({
              id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1",
              rentalAssetId: ASSET_A_ID,
              assetName: "Quadra 1",
              startTime: "08:00:00",
              endTime: "09:00:00",
            }),
          ],
        })
      }
      return Promise.reject(new Error("schedule down"))
    })
    bookSlot.mockResolvedValue(makeReservation("Confirmed", FUTURE_ISO))
    renderAgenda()

    await bookQuadra1(user)

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalled()
    })
    await waitFor(() => {
      expect(dayCalls).toBeGreaterThanOrEqual(2)
    })
    expect(toastError).not.toHaveBeenCalled()
    expect(
      screen.queryByRole("button", {
        name: i18n.t("tenantPortal.agenda.reserving"),
      }),
    ).not.toBeInTheDocument()
    expect(screen.getAllByText("Quadra 1").length).toBeGreaterThan(0)
  })

  it("does not offer a date before today in America/Sao_Paulo", async () => {
    renderAgenda()

    const dateInput = await screen.findByLabelText(
      i18n.t("tenantPortal.agenda.date"),
    )
    expect(dateInput).toHaveAttribute("min", brazilTodayIsoDate())
    expect(dateInput).toHaveValue(brazilTodayIsoDate())
  })

  it("hides slots that already started today and explains that they are hidden", async () => {
    vi.setSystemTime(new Date("2026-10-14T15:00:00.000Z"))
    fetchDay.mockResolvedValue({
      date: "2026-10-14",
      slots: [
        makeSlot({
          id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1",
          rentalAssetId: ASSET_A_ID,
          assetName: "Quadra 1",
          startTime: "08:00:00",
          endTime: "09:00:00",
        }),
        makeSlot({
          id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee3",
          rentalAssetId: ASSET_A_ID,
          assetName: "Quadra 1",
          startTime: "13:00:00",
          endTime: "14:00:00",
        }),
      ],
    })
    const user = userEvent.setup()
    renderAgenda()

    expect(
      await screen.findByText(i18n.t("tenantPortal.agenda.pastSlotsHidden")),
    ).toBeInTheDocument()

    await user.click(
      await screen.findByRole("combobox", {
        name: i18n.t("tenantPortal.agenda.time"),
      }),
    )
    expect(
      await screen.findByRole("option", { name: "13:00 – 14:00" }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("option", { name: "08:00 – 09:00" }),
    ).not.toBeInTheDocument()
  })

  it("keeps morning slots on a later date", async () => {
    vi.setSystemTime(new Date("2026-10-14T15:00:00.000Z"))
    const user = userEvent.setup()
    renderAgenda()

    const dateInput = await screen.findByLabelText(
      i18n.t("tenantPortal.agenda.date"),
    )
    fireEvent.change(dateInput, { target: { value: "2026-10-15" } })

    await waitFor(() => {
      expect(fetchDay).toHaveBeenCalledWith("ficc", "2026-10-15")
    })
    await user.click(
      screen.getByRole("combobox", {
        name: i18n.t("tenantPortal.agenda.time"),
      }),
    )
    expect(
      await screen.findByRole("option", { name: "08:00 – 09:00" }),
    ).toBeInTheDocument()
    expect(
      screen.queryByText(i18n.t("tenantPortal.agenda.pastSlotsHidden")),
    ).not.toBeInTheDocument()
  })

  it("clamps a past date back to today", async () => {
    renderAgenda()

    const dateInput = await screen.findByLabelText(
      i18n.t("tenantPortal.agenda.date"),
    )
    fireEvent.change(dateInput, { target: { value: "2020-01-01" } })

    await waitFor(() => {
      expect(dateInput).toHaveValue(brazilTodayIsoDate())
    })
    expect(fetchDay).not.toHaveBeenCalledWith("ficc", "2020-01-01")
  })

  it("says the time was just taken and refreshes the agenda after a booking conflict", async () => {
    const user = userEvent.setup()
    bookSlot.mockRejectedValue(
      new PortalBookingError(
        "O local 'Sala 1' não está disponível para o intervalo solicitado.",
        409,
        null,
      ),
    )
    renderAgenda()
    await screen.findByRole("button", { name: "Quadra 1" })
    const dayCalls = fetchDay.mock.calls.length
    const mineCalls = listMine.mock.calls.length

    await bookQuadra1(user)

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith(
        i18n.t("tenantPortal.agenda.slotJustTaken"),
      )
    })
    expect(toastError).not.toHaveBeenCalledWith(
      expect.stringContaining("não está disponível"),
    )
    await waitFor(() => {
      expect(fetchDay.mock.calls.length).toBeGreaterThan(dayCalls)
      expect(listMine.mock.calls.length).toBeGreaterThan(mineCalls)
    })
  })

  it("translates the daily booking limit without refreshing the agenda", async () => {
    const user = userEvent.setup()
    bookSlot.mockRejectedValue(
      new PortalBookingError(
        "Limite de 2 reservas ativas por dia atingido.",
        409,
        "DAILY_BOOKING_LIMIT_REACHED",
      ),
    )
    renderAgenda()
    await screen.findByRole("button", { name: "Quadra 1" })
    const dayCalls = fetchDay.mock.calls.length

    await bookQuadra1(user)

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith(
        i18n.t("tenantPortal.agenda.dailyLimitReached", { count: 2 }),
      )
    })
    expect(fetchDay.mock.calls.length).toBe(dayCalls)
    expect(toastError).not.toHaveBeenCalledWith(
      i18n.t("tenantPortal.agenda.slotJustTaken"),
    )
  })

  it("uses the limit message without a number when the payload omits one", async () => {
    const user = userEvent.setup()
    bookSlot.mockRejectedValue(
      new PortalBookingError("limit reached", 409, "DAILY_BOOKING_LIMIT_REACHED"),
    )
    renderAgenda()

    await bookQuadra1(user)

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith(
        i18n.t("tenantPortal.agenda.dailyLimitReachedUnknown"),
      )
    })
  })

  it("translates the daily limit when the reservation is created without a slot id", async () => {
    const user = userEvent.setup()
    fetchDay.mockResolvedValue({
      date: "2026-09-12",
      slots: [
        {
          ...makeSlot({
            id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1",
            rentalAssetId: ASSET_A_ID,
            assetName: "Quadra 1",
            startTime: "08:00:00",
            endTime: "09:00:00",
          }),
          isDerived: true,
        },
      ],
    })
    createReservation.mockRejectedValue(
      new PortalBookingError(
        "Limite de 4 reservas ativas por dia atingido.",
        409,
        "DAILY_BOOKING_LIMIT_REACHED",
      ),
    )
    renderAgenda()

    await bookQuadra1(user)

    await waitFor(() => {
      expect(createReservation).toHaveBeenCalled()
    })
    expect(bookSlot).not.toHaveBeenCalled()
    expect(toastError).toHaveBeenCalledWith(
      i18n.t("tenantPortal.agenda.dailyLimitReached", { count: 4 }),
    )
  })

  it("keeps a queue failure on the queue message", async () => {
    const user = userEvent.setup()
    bookSlot.mockRejectedValue(
      new PortalBookingError("QUEUE_REQUIRED", 409, null),
    )
    renderAgenda()
    await screen.findByRole("button", { name: "Quadra 1" })
    const dayCalls = fetchDay.mock.calls.length

    await bookQuadra1(user)

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith(
        i18n.t("tenantPortal.agenda.queue.errors.QUEUE_REQUIRED"),
      )
    })
    expect(toastError).not.toHaveBeenCalledWith(
      i18n.t("tenantPortal.agenda.slotJustTaken"),
    )
    expect(fetchDay.mock.calls.length).toBe(dayCalls)
  })

  it("shows a non-conflict booking error without refreshing the agenda", async () => {
    const user = userEvent.setup()
    bookSlot.mockRejectedValue(
      new PortalBookingError(
        "Slot does not belong to the given unit.",
        409,
        null,
      ),
    )
    renderAgenda()
    await screen.findByRole("button", { name: "Quadra 1" })
    const dayCalls = fetchDay.mock.calls.length

    await bookQuadra1(user)

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith(
        "Slot does not belong to the given unit.",
      )
    })
    expect(fetchDay.mock.calls.length).toBe(dayCalls)
  })

  it("paints every available space the same way, including the selected one", async () => {
    const user = userEvent.setup()
    fetchDay.mockResolvedValue({
      date: "2026-10-14",
      slots: [
        makeSlot({
          id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1",
          rentalAssetId: ASSET_A_ID,
          assetName: "Quadra 1",
          startTime: "08:00:00",
          endTime: "09:00:00",
        }),
        makeSlot({
          id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2",
          rentalAssetId: ASSET_B_ID,
          assetName: "Quadra 2",
          startTime: "08:00:00",
          endTime: "09:00:00",
        }),
      ],
    })
    renderAgenda()

    const courtOne = await screen.findByRole("button", { name: "Quadra 1" })
    const courtTwo = screen.getByRole("button", { name: "Quadra 2" })
    expect(courtOne.className).toContain("bg-emerald-100")
    expect(courtTwo.className).toContain("bg-emerald-100")
    expect(courtOne.className).not.toContain("bg-primary/20")
    expect(courtTwo.className).not.toContain("bg-primary/20")

    await user.click(courtOne)

    expect(courtOne.className).toContain("bg-emerald-100")
    expect(courtOne.className).toContain("ring-2")
    expect(courtTwo.className).toContain("bg-emerald-100")
    expect(
      screen.getByText(i18n.t("tenantPortal.agenda.legendUnavailable")).className,
    ).toContain("text-foreground")
    expect(
      screen.getByText(i18n.t("tenantPortal.agenda.legendUnavailable")).className,
    ).not.toContain("text-muted-foreground")
  })

  it("explains a foreign booked row as unavailable", async () => {
    fetchDay.mockResolvedValue({
      date: "2026-10-14",
      slots: [
        makeSlot({
          id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1",
          rentalAssetId: ASSET_A_ID,
          assetName: "Quadra 1",
          startTime: "08:00:00",
          endTime: "09:00:00",
        }),
        makeSlot({
          id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2",
          rentalAssetId: ASSET_B_ID,
          assetName: "Quadra 2",
          startTime: "08:00:00",
          endTime: "09:00:00",
          status: "booked",
          isBookableByCustomer: false,
          reservationId: "99999999-9999-4999-8999-999999999999",
        }),
      ],
    })
    renderAgenda()

    expect(
      await screen.findByRole("button", { name: "Quadra 1" }),
    ).toBeEnabled()
    const taken = screen.getByRole("button", {
      name: `Quadra 2. ${i18n.t("tenantPortal.agenda.unavailable")}`,
    })
    expect(taken).toHaveAttribute("aria-disabled", "true")
    expect(taken).toHaveTextContent(i18n.t("tenantPortal.agenda.unavailable"))
    expect(taken).not.toHaveTextContent(i18n.t("tenantPortal.agenda.slotReserved"))
    expect(taken).not.toHaveAttribute(
      "title",
      i18n.t("tenantPortal.agenda.slotReserved"),
    )
  })

  it("announces reserved when the public reservation belongs to this customer", async () => {
    listMine.mockResolvedValue([
      makeReservation("Confirmed", FUTURE_ISO, {
        items: [
          {
            id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
            assetId: ASSET_B_ASSET_ID,
            rentalAssetId: ASSET_B_ID,
            assetName: "Quadra 2",
            quantity: 1,
            unitPrice: 80,
            subTotal: 80,
          },
        ],
      }),
    ])
    fetchDay.mockResolvedValue({
      date: "2026-10-14",
      slots: [
        makeSlot({
          id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1",
          rentalAssetId: ASSET_A_ID,
          assetName: "Quadra 1",
          startTime: "08:00:00",
          endTime: "09:00:00",
        }),
        makeSlot({
          id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2",
          rentalAssetId: ASSET_B_ID,
          assetName: "Quadra 2",
          startTime: "08:00:00",
          endTime: "09:00:00",
          status: "booked",
          isBookableByCustomer: false,
          reservationId: RESERVATION_ID,
        }),
      ],
    })
    renderAgenda()

    const taken = await screen.findByRole("button", {
      name: `Quadra 2. ${i18n.t("tenantPortal.agenda.slotReserved")}`,
    })
    expect(taken).toHaveAttribute("aria-disabled", "true")
    expect(taken).toHaveTextContent(i18n.t("tenantPortal.agenda.slotReserved"))
  })

  it("does not announce reserved for a booked row with no reservation id", async () => {
    fetchDay.mockResolvedValue({
      date: "2026-10-14",
      slots: [
        makeSlot({
          id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1",
          rentalAssetId: ASSET_A_ID,
          assetName: "Quadra 1",
          startTime: "08:00:00",
          endTime: "09:00:00",
        }),
        makeSlot({
          id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2",
          rentalAssetId: ASSET_B_ID,
          assetName: "Quadra 2",
          startTime: "08:00:00",
          endTime: "09:00:00",
          status: "booked",
          isBookableByCustomer: false,
          reservationId: null,
        }),
      ],
    })
    renderAgenda()

    const taken = await screen.findByRole("button", {
      name: `Quadra 2. ${i18n.t("tenantPortal.agenda.unavailable")}`,
    })
    expect(taken).toHaveTextContent(i18n.t("tenantPortal.agenda.unavailable"))
    expect(taken).not.toHaveTextContent(i18n.t("tenantPortal.agenda.slotReserved"))
  })

  it("explains an unplaced space that is not offered at the selected time", async () => {
    fetchLayouts.mockResolvedValue([
      {
        id: "12121212-1212-4121-8121-121212121212",
        unitId: null,
        name: "Mapa",
        isActive: true,
        aspectRatio: 1.6,
        widthPercent: 100,
        items: [
          {
            id: "13131313-1313-4131-8131-131313131313",
            rentalAssetId: ASSET_A_ID,
            assetName: "Quadra 1",
            xPercent: 4,
            yPercent: 4,
            widthPercent: 40,
            heightPercent: 40,
            zIndex: 1,
          },
        ],
      },
    ])
    fetchDay.mockResolvedValue({
      date: "2026-10-14",
      slots: [
        makeSlot({
          id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1",
          rentalAssetId: ASSET_A_ID,
          assetName: "Quadra 1",
          startTime: "08:00:00",
          endTime: "09:00:00",
        }),
        makeSlot({
          id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2",
          rentalAssetId: ASSET_B_ID,
          assetName: "Quadra 2",
          startTime: "09:00:00",
          endTime: "10:00:00",
        }),
      ],
    })
    renderAgenda()

    const placed = await screen.findByRole("button", { name: "Quadra 1" })
    expect(placed.className).toContain("bg-emerald-100")
    const unplaced = screen.getByRole("button", {
      name: `Quadra 2. ${i18n.t("tenantPortal.agenda.unavailable")}`,
    })
    expect(unplaced.className).toContain("bg-muted")
    expect(unplaced.className).toContain("text-foreground")
    expect(unplaced).toHaveTextContent(i18n.t("tenantPortal.agenda.unavailable"))
  })

  it("leaves Reservando as soon as the conflict response arrives and marks the space reserved", async () => {
    const user = userEvent.setup()
    let rejectBooking: (error: unknown) => void = () => {}
    bookSlot.mockImplementation(
      () =>
        new Promise((_, reject) => {
          rejectBooking = reject
        }),
    )
    let dayCalls = 0
    fetchDay.mockImplementation(() => {
      dayCalls += 1
      if (dayCalls === 1) {
        return Promise.resolve({
          date: "2026-10-14",
          slots: [
            makeSlot({
              id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1",
              rentalAssetId: ASSET_A_ID,
              assetName: "Quadra 1",
              startTime: "08:00:00",
              endTime: "09:00:00",
            }),
          ],
        })
      }
      return new Promise(() => {})
    })
    renderAgenda()

    await bookQuadra1(user)

    const reserving = await screen.findByRole("button", {
      name: i18n.t("tenantPortal.agenda.reserving"),
    })
    expect(reserving).toHaveAttribute("aria-busy", "true")

    rejectBooking(
      new PortalBookingError(
        "O local 'Sala 1' não está disponível para o intervalo solicitado.",
        409,
        null,
      ),
    )

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith(
        i18n.t("tenantPortal.agenda.slotJustTaken"),
      )
    })
    expect(
      screen.queryByRole("button", {
        name: i18n.t("tenantPortal.agenda.reserving"),
      }),
    ).not.toBeInTheDocument()
    const reserve = screen.getByRole("button", {
      name: i18n.t("tenantPortal.agenda.reserveSlot"),
    })
    expect(reserve).not.toHaveAttribute("aria-busy", "true")
    expect(dayCalls).toBeGreaterThanOrEqual(2)
    expect(
      screen.getByRole("button", {
        name: `Quadra 1. ${i18n.t("tenantPortal.agenda.slotReserved")}`,
      }),
    ).toHaveTextContent(i18n.t("tenantPortal.agenda.slotReserved"))
  })

  it.each([
    "Slot is not available for booking.",
    "Insufficient quantity for this slot.",
  ])("toasts %s without marking the card reserved", async (message) => {
    const user = userEvent.setup()
    bookSlot.mockRejectedValue(new PortalBookingError(message, 409, null))
    renderAgenda()

    await bookQuadra1(user)

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith(message)
    })
    expect(toastError).not.toHaveBeenCalledWith(
      i18n.t("tenantPortal.agenda.slotJustTaken"),
    )
    const card = screen.getByRole("button", {
      name: `Quadra 1. ${i18n.t("tenantPortal.agenda.unavailable")}`,
    })
    expect(card).toHaveAttribute("aria-disabled", "true")
    expect(card).toHaveTextContent(i18n.t("tenantPortal.agenda.unavailable"))
    expect(card).not.toHaveTextContent(
      i18n.t("tenantPortal.agenda.slotReserved"),
    )
  })

  it("clears the reserved mark when this browser's booking is canceled", async () => {
    const user = userEvent.setup()
    const created = makeReservation("Confirmed", FUTURE_ISO)
    let dayCalls = 0
    fetchDay.mockImplementation(() => {
      dayCalls += 1
      if (dayCalls === 1) {
        return Promise.resolve({
          date: "2026-10-14",
          slots: [
            makeSlot({
              id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1",
              rentalAssetId: ASSET_A_ID,
              assetName: "Quadra 1",
              startTime: "08:00:00",
              endTime: "09:00:00",
            }),
          ],
        })
      }
      return new Promise(() => {})
    })
    bookSlot.mockResolvedValue(created)
    cancelMine.mockResolvedValue(makeReservation("Canceled", FUTURE_ISO))
    renderAgenda()

    await bookQuadra1(user)

    expect(
      await screen.findByRole("button", {
        name: `Quadra 1. ${i18n.t("tenantPortal.agenda.slotReserved")}`,
      }),
    ).toBeInTheDocument()

    await confirmCancel(user)

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith(
        i18n.t("tenantPortal.agenda.cancelSuccess"),
      )
    })
    expect(
      screen.queryByRole("button", {
        name: `Quadra 1. ${i18n.t("tenantPortal.agenda.slotReserved")}`,
      }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole("button", {
        name: `Quadra 1. ${i18n.t("tenantPortal.agenda.unavailable")}`,
      }),
    ).toBeInTheDocument()
    expect(dayCalls).toBeGreaterThanOrEqual(2)
  })
})

describe("TenantPortalAgendaPage ?reservation=", () => {
  const FOREIGN_ID = "99999999-9999-4999-8999-999999999999"
  let scrollIntoView: ReturnType<typeof vi.fn>

  beforeEach(() => {
    listMine.mockReset()
    fetchAssets.mockReset()
    fetchLayouts.mockReset()
    fetchDay.mockReset()
    cancelMine.mockReset()
    checkAvailability.mockReset()
    bookSlot.mockReset()
    fetchQueue.mockReset()
    joinQueue.mockReset()
    createReservation.mockReset()
    fetchPolicy.mockReset()
    toastSuccess.mockReset()
    toastError.mockReset()
    fetchPolicy.mockResolvedValue({
      cancellationPolicyText: null,
      maxActiveReservationsPerCustomerPerDay: null,
    })
    fetchAssets.mockResolvedValue([])
    fetchLayouts.mockResolvedValue([])
    fetchDay.mockResolvedValue({ date: brazilTodayIsoDate(), slots: [] })
    listMine.mockResolvedValue([])
    scrollIntoView = vi.fn()
    HTMLElement.prototype.scrollIntoView =
      scrollIntoView as typeof HTMLElement.prototype.scrollIntoView
  })

  afterEach(() => {
    Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView")
  })

  it("selects and scrolls to the customer's visible reservation without changing the day", async () => {
    const otherId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
    listMine.mockResolvedValue([
      makeReservation("Confirmed", FUTURE_ISO, {
        id: otherId,
        items: [
          {
            id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeef",
            assetId: "ffffffff-ffff-4fff-8fff-fffffffffffe",
            rentalAssetId: "11111111-1111-4111-8111-111111111112",
            assetName: "Quadra 2",
            quantity: 1,
            unitPrice: 40,
            subTotal: 40,
          },
        ],
      }),
      makeReservation("Confirmed", FUTURE_ISO),
    ])

    renderAgenda(`/agenda?reservation=${RESERVATION_ID.toUpperCase()}`)

    const focused = (await screen.findByText("Quadra 1")).closest("li")
    const other = screen.getByText("Quadra 2").closest("li")
    expect(focused).toHaveAttribute("data-reservation-focused", "true")
    expect(focused).toHaveAttribute("aria-current", "true")
    expect(other).not.toHaveAttribute("data-reservation-focused")
    await waitFor(() => {
      expect(scrollIntoView).toHaveBeenCalledWith({ block: "center" })
    })
    expect(scrollIntoView.mock.instances).toContain(focused)
    expect(screen.getByLabelText(i18n.t("tenantPortal.agenda.date"))).toHaveValue(
      brazilTodayIsoDate(),
    )
    expect(fetchDay).toHaveBeenCalledWith("ficc", brazilTodayIsoDate())
    expect(
      fetchDay.mock.calls.some((call) => String(call[1]).startsWith("2099")),
    ).toBe(false)
    expect(document.body).not.toHaveTextContent(RESERVATION_ID)
  })

  it("stays on the normal agenda for a malformed or foreign id", async () => {
    listMine.mockResolvedValue([
      makeReservation("Confirmed", FUTURE_ISO),
      makeReservation("Canceled", FUTURE_ISO, {
        id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        items: [
          {
            id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeed",
            assetId: "ffffffff-ffff-4fff-8fff-fffffffffffd",
            rentalAssetId: "11111111-1111-4111-8111-111111111113",
            assetName: "Quadra cancelada",
            quantity: 1,
            unitPrice: 10,
            subTotal: 10,
          },
        ],
      }),
    ])

    const { unmount } = renderAgenda("/agenda?reservation=not-a-guid")
    expect(await screen.findByText("Quadra 1")).toBeInTheDocument()
    expect(screen.getByText("Quadra 1").closest("li")).not.toHaveAttribute(
      "data-reservation-focused",
    )
    expect(document.body).not.toHaveTextContent("not-a-guid")
    expect(toastError).not.toHaveBeenCalled()
    unmount()

    const { unmount: unmountForeign } = renderAgenda(
      `/agenda?reservation=${FOREIGN_ID}`,
    )
    expect(await screen.findByText("Quadra 1")).toBeInTheDocument()
    expect(screen.getByText("Quadra 1").closest("li")).not.toHaveAttribute(
      "data-reservation-focused",
    )
    expect(document.body).not.toHaveTextContent(FOREIGN_ID)
    expect(toastError).not.toHaveBeenCalled()
    expect(screen.getByText("Quadra cancelada")).toBeInTheDocument()
    unmountForeign()

    renderAgenda(
      `/agenda?reservation=${encodeURIComponent("<script>alert(1)</script>")}`,
    )
    expect(await screen.findByText("Quadra 1")).toBeInTheDocument()
    expect(document.body.innerHTML).not.toContain("<script>alert(1)</script>")
    expect(toastError).not.toHaveBeenCalled()
  })

  it("does not open a canceled reservation from the query", async () => {
    listMine.mockResolvedValue([makeReservation("Canceled", FUTURE_ISO)])
    renderAgenda(`/agenda?reservation=${RESERVATION_ID}`)

    const row = (await screen.findByText("Quadra 1")).closest("li")
    expect(row).not.toHaveAttribute("data-reservation-focused")
    expect(scrollIntoView).not.toHaveBeenCalled()
    expect(document.body).not.toHaveTextContent(RESERVATION_ID)
    expect(toastError).not.toHaveBeenCalled()
    expect(screen.getByLabelText(i18n.t("tenantPortal.agenda.date"))).toHaveValue(
      brazilTodayIsoDate(),
    )
  })
})

const QUEUE_TICKET_ID = "99999999-9999-4999-8999-999999999991"

function queueTicket(
  status: "Waiting" | "Active" | "Expired",
  overrides: Partial<NonNullable<ReservationQueueStatus["myTicket"]>> = {},
): NonNullable<ReservationQueueStatus["myTicket"]> {
  return {
    id: QUEUE_TICKET_ID,
    status,
    sequence: 1,
    position: status === "Waiting" ? 2 : 1,
    joinedAt: "2026-10-15T08:00:00.000Z",
    turnStartedAt: status === "Active" ? "2026-10-15T08:00:00.000Z" : null,
    turnExpiresAt: status === "Active" ? "2026-10-15T08:01:30.000Z" : null,
    completedReservationId: null,
    ...overrides,
  }
}

function queueStatus(
  overrides: Partial<ReservationQueueStatus> = {},
): ReservationQueueStatus {
  return {
    rentalAssetId: ASSET_A_ID,
    queueEnabled: true,
    openingDate: "2026-10-15",
    opensAt: "2026-10-15T13:00:00.000Z",
    waitingRoomOpensAt: "2026-10-15T12:30:00.000Z",
    serverNow: "2026-10-15T08:00:00.000Z",
    phase: "Open",
    waitingCount: 0,
    aheadCount: 0,
    myTicket: null,
    ...overrides,
  }
}

function buttonNamed(name: string) {
  return screen.getByRole("button", {
    name: (accessibleName) => accessibleName === name,
  })
}

function queryButtonNamed(name: string) {
  return screen.queryByRole("button", {
    name: (accessibleName) => accessibleName === name,
  })
}

describe("TenantPortalAgendaPage queue explainer", () => {
  beforeEach(() => {
    vi.useFakeTimers({
      toFake: ["Date"],
      now: new Date("2026-10-15T08:00:00.000Z"),
    })
    listMine.mockReset()
    fetchAssets.mockReset()
    fetchLayouts.mockReset()
    fetchDay.mockReset()
    cancelMine.mockReset()
    checkAvailability.mockReset()
    bookSlot.mockReset()
    createReservation.mockReset()
    fetchPolicy.mockReset()
    fetchQueue.mockReset()
    joinQueue.mockReset()
    toastSuccess.mockReset()
    toastError.mockReset()
    fetchPolicy.mockResolvedValue({
      cancellationPolicyText: null,
      maxActiveReservationsPerCustomerPerDay: null,
    })
    checkAvailability.mockResolvedValue({
      isAvailable: true,
      requestedQuantity: 1,
      availableQuantity: 1,
      estimatedTotalAmount: 80,
      reason: null,
    })
    listMine.mockResolvedValue([])
    fetchLayouts.mockResolvedValue([])
    fetchAssets.mockResolvedValue([
      {
        ...makeAsset(ASSET_A_ID, ASSET_A_ASSET_ID, "Quadra 1"),
        queueEnabled: true,
        queueOpeningTime: "07:30:00",
        requiresDeposit: false,
      },
      {
        ...makeAsset(ASSET_B_ID, ASSET_B_ASSET_ID, "Quadra 2"),
        requiresDeposit: false,
      },
    ])
    fetchDay.mockResolvedValue({
      date: "2026-10-15",
      slots: [
        makeSlot({
          id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1",
          rentalAssetId: ASSET_A_ID,
          assetName: "Quadra 1",
          startTime: "08:00:00",
          endTime: "09:00:00",
          date: "2026-10-15",
        }),
        makeSlot({
          id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2",
          rentalAssetId: ASSET_B_ID,
          assetName: "Quadra 2",
          startTime: "08:00:00",
          endTime: "09:00:00",
          date: "2026-10-15",
        }),
      ],
    })
    fetchQueue.mockResolvedValue(queueStatus())
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  async function chooseCourt(
    user: ReturnType<typeof userEvent.setup>,
    name: string,
  ) {
    await user.click(await screen.findByRole("button", { name }))
  }

  it("explains the ticket only for a resource that requires a queue", async () => {
    const user = userEvent.setup()
    renderAgenda()

    await chooseCourt(user, "Quadra 2")

    expect(buttonNamed(i18n.t("tenantPortal.agenda.reserveSlot"))).toBeEnabled()
    expect(
      screen.queryByText(i18n.t("tenantPortal.agenda.queue.requiresTicket")),
    ).not.toBeInTheDocument()
    expect(fetchQueue).not.toHaveBeenCalled()

    await chooseCourt(user, "Quadra 1")

    expect(
      await screen.findByText(i18n.t("tenantPortal.agenda.queue.requiresTicket")),
    ).toBeInTheDocument()
    expect(fetchQueue).toHaveBeenCalledWith(ASSET_A_ID)
  })

  it("shows the join view while the waiting room is open", async () => {
    fetchQueue.mockResolvedValue(
      queueStatus({ phase: "WaitingRoom", aheadCount: 0, waitingCount: 0 }),
    )
    const user = userEvent.setup()
    renderAgenda()
    await chooseCourt(user, "Quadra 1")

    expect(
      await screen.findByText(i18n.t("tenantPortal.agenda.queue.requiresTicket")),
    ).toBeInTheDocument()
    expect(buttonNamed(i18n.t("tenantPortal.agenda.queue.join"))).toBeEnabled()
    expect(
      queryButtonNamed(i18n.t("tenantPortal.agenda.queue.joinAndReserve")),
    ).not.toBeInTheDocument()
    expect(buttonNamed(i18n.t("tenantPortal.agenda.reserveSlot"))).toBeDisabled()

    joinQueue.mockResolvedValue(
      queueStatus({
        phase: "WaitingRoom",
        aheadCount: 0,
        waitingCount: 1,
        myTicket: queueTicket("Waiting", { position: 1 }),
      }),
    )
    await user.click(buttonNamed(i18n.t("tenantPortal.agenda.queue.join")))

    await waitFor(() => {
      expect(joinQueue).toHaveBeenCalledWith(ASSET_A_ID)
    })
    expect(bookSlot).not.toHaveBeenCalled()
    expect(createReservation).not.toHaveBeenCalled()
  })

  it("keeps join separate when someone is already ahead", async () => {
    fetchQueue.mockResolvedValue(
      queueStatus({ phase: "Open", aheadCount: 2, waitingCount: 2 }),
    )
    const user = userEvent.setup()
    renderAgenda()
    await chooseCourt(user, "Quadra 1")

    expect(
      await screen.findByText(i18n.t("tenantPortal.agenda.queue.requiresTicket")),
    ).toBeInTheDocument()
    expect(buttonNamed(i18n.t("tenantPortal.agenda.queue.join"))).toBeEnabled()
    expect(
      queryButtonNamed(i18n.t("tenantPortal.agenda.queue.joinAndReserve")),
    ).not.toBeInTheDocument()
    expect(buttonNamed(i18n.t("tenantPortal.agenda.reserveSlot"))).toBeDisabled()
  })

  it("offers one join-and-reserve action when the queue is open and nobody is ahead", async () => {
    joinQueue.mockResolvedValue(
      queueStatus({ myTicket: queueTicket("Active") }),
    )
    bookSlot.mockResolvedValue(makeReservation("Confirmed", FUTURE_ISO))
    const user = userEvent.setup()
    renderAgenda()
    await chooseCourt(user, "Quadra 1")

    expect(
      await screen.findByText(i18n.t("tenantPortal.agenda.queue.requiresTicket")),
    ).toBeInTheDocument()
    const action = await screen.findByRole("button", {
      name: (accessibleName) =>
        accessibleName === i18n.t("tenantPortal.agenda.queue.joinAndReserve"),
    })
    expect(action).toBeEnabled()
    expect(
      queryButtonNamed(i18n.t("tenantPortal.agenda.queue.join")),
    ).not.toBeInTheDocument()
    expect(
      queryButtonNamed(i18n.t("tenantPortal.agenda.reserveSlot")),
    ).not.toBeInTheDocument()

    await user.click(action)

    await waitFor(() => {
      expect(bookSlot).toHaveBeenCalledWith({
        slotId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1",
        unitId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        quantity: 1,
      })
    })
    expect(joinQueue).toHaveBeenCalledWith(ASSET_A_ID)
    expect(joinQueue.mock.invocationCallOrder[0]).toBeLessThan(
      bookSlot.mock.invocationCallOrder[0] ?? 0,
    )
    expect(createReservation).not.toHaveBeenCalled()
  })

  it("does not reserve when joining leaves the ticket waiting", async () => {
    joinQueue.mockResolvedValue(
      queueStatus({
        phase: "Open",
        aheadCount: 1,
        waitingCount: 2,
        myTicket: queueTicket("Waiting"),
      }),
    )
    const user = userEvent.setup()
    renderAgenda()
    await chooseCourt(user, "Quadra 1")
    await user.click(
      await screen.findByRole("button", {
        name: (accessibleName) =>
          accessibleName === i18n.t("tenantPortal.agenda.queue.joinAndReserve"),
      }),
    )

    expect(
      await screen.findByText(i18n.t("tenantPortal.agenda.queue.inQueue")),
    ).toBeInTheDocument()
    expect(bookSlot).not.toHaveBeenCalled()
    expect(createReservation).not.toHaveBeenCalled()
  })

  it("shows the waiting view with position and people ahead", async () => {
    fetchQueue.mockResolvedValue(
      queueStatus({
        phase: "Open",
        aheadCount: 1,
        waitingCount: 2,
        myTicket: queueTicket("Waiting"),
      }),
    )
    const user = userEvent.setup()
    renderAgenda()
    await chooseCourt(user, "Quadra 1")

    expect(
      await screen.findByText(i18n.t("tenantPortal.agenda.queue.requiresTicket")),
    ).toBeInTheDocument()
    expect(
      screen.getByText(i18n.t("tenantPortal.agenda.queue.inQueue")),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        i18n.t("tenantPortal.agenda.queue.position", { position: 2 }),
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByText(i18n.t("tenantPortal.agenda.queue.ahead", { count: 1 })),
    ).toBeInTheDocument()
    expect(buttonNamed(i18n.t("tenantPortal.agenda.queue.leave"))).toBeEnabled()
    expect(buttonNamed(i18n.t("tenantPortal.agenda.reserveSlot"))).toBeDisabled()
    expect(
      queryButtonNamed(i18n.t("tenantPortal.agenda.queue.joinAndReserve")),
    ).not.toBeInTheDocument()
  })

  it("shows the active view and enables reserve during the turn", async () => {
    fetchQueue.mockResolvedValue(
      queueStatus({ myTicket: queueTicket("Active") }),
    )
    const user = userEvent.setup()
    renderAgenda()
    await chooseCourt(user, "Quadra 1")

    expect(
      await screen.findByText(i18n.t("tenantPortal.agenda.queue.requiresTicket")),
    ).toBeInTheDocument()
    expect(
      screen.getByText(i18n.t("tenantPortal.agenda.queue.yourTurn")),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        i18n.t("tenantPortal.agenda.queue.countdown", { time: "01:30" }),
      ),
    ).toBeInTheDocument()
    expect(buttonNamed(i18n.t("tenantPortal.agenda.reserveSlot"))).toBeEnabled()
  })

  it("shows the expired view without the reserve action", async () => {
    fetchQueue.mockResolvedValue(
      queueStatus({ myTicket: queueTicket("Expired") }),
    )
    const user = userEvent.setup()
    renderAgenda()
    await chooseCourt(user, "Quadra 1")

    expect(
      await screen.findByText(i18n.t("tenantPortal.agenda.queue.requiresTicket")),
    ).toBeInTheDocument()
    expect(
      screen.getByText(i18n.t("tenantPortal.agenda.queue.expired")),
    ).toBeInTheDocument()
    expect(buttonNamed(i18n.t("tenantPortal.agenda.queue.rejoin"))).toBeEnabled()
    expect(
      queryButtonNamed(i18n.t("tenantPortal.agenda.reserveSlot")),
    ).not.toBeInTheDocument()
  })

  it("shows the closed view before the waiting room opens", async () => {
    fetchQueue.mockResolvedValue(
      queueStatus({ phase: "Closed", myTicket: null }),
    )
    const user = userEvent.setup()
    renderAgenda()
    await chooseCourt(user, "Quadra 1")

    expect(
      await screen.findByText(i18n.t("tenantPortal.agenda.queue.requiresTicket")),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        i18n.t("tenantPortal.agenda.queue.closed", {
          waitingRoom: "09:30",
          opensAt: "10:00",
        }),
      ),
    ).toBeInTheDocument()
    expect(
      queryButtonNamed(i18n.t("tenantPortal.agenda.queue.join")),
    ).not.toBeInTheDocument()
    expect(
      queryButtonNamed(i18n.t("tenantPortal.agenda.queue.joinAndReserve")),
    ).not.toBeInTheDocument()
    expect(buttonNamed(i18n.t("tenantPortal.agenda.reserveSlot"))).toBeDisabled()
  })

  it("keeps the explanation and the one-step action in pt-BR, en, and es", () => {
    const copies = [
      ptBRCommon.tenantPortal.agenda.queue,
      enCommon.tenantPortal.agenda.queue,
      esCommon.tenantPortal.agenda.queue,
    ]
    for (const copy of copies) {
      expect(copy.requiresTicket.length).toBeGreaterThan(0)
      expect(copy.joinAndReserve.length).toBeGreaterThan(0)
      expect(copy.joiningAndReserving.length).toBeGreaterThan(0)
    }
    expect(ptBRCommon.tenantPortal.agenda.queue.joinAndReserve).toBe(
      "Entrar na fila e reservar",
    )
    expect(enCommon.tenantPortal.agenda.queue.requiresTicket).not.toBe(
      ptBRCommon.tenantPortal.agenda.queue.requiresTicket,
    )
    expect(esCommon.tenantPortal.agenda.queue.requiresTicket).not.toBe(
      ptBRCommon.tenantPortal.agenda.queue.requiresTicket,
    )
    expect(enCommon.tenantPortal.agenda.queue.joinAndReserve).not.toBe(
      ptBRCommon.tenantPortal.agenda.queue.joinAndReserve,
    )
    expect(esCommon.tenantPortal.agenda.queue.joinAndReserve).not.toBe(
      ptBRCommon.tenantPortal.agenda.queue.joinAndReserve,
    )
  })
})
