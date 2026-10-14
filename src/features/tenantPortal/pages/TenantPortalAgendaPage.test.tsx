import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { MemoryRouter, Outlet, Route, Routes } from "react-router-dom"

import { formatMoney } from "@/features/rentals/services/reservationsService"
import { brazilTodayIsoDate } from "@/lib/brazilTimeZone"
import i18n from "@/lib/i18n"
import type { CustomerAppOutletContext } from "@/features/tenantPortal/components/CustomerAppLayout"
import type {
  PortalRentalAsset,
  PortalReservation,
  PortalScheduleSlot,
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

vi.mock("@/features/tenantPortal/services/tenantPortalService", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@/features/tenantPortal/services/tenantPortalService")
    >()
  return {
    ...actual,
    getCustomerAccessToken: vi.fn(() => "test-customer-token"),
    fetchPortalRentalAssets: vi.fn(),
    listMyPortalReservations: vi.fn(),
    fetchPublicScheduleDay: vi.fn(),
    cancelMyPortalReservation: vi.fn(),
    bookPortalSlot: vi.fn(),
    checkPortalAvailability: vi.fn(),
    createPortalReservation: vi.fn(),
  }
})

import { toast } from "sonner"
import { fetchPublicRentalLayouts } from "@/features/rentals/services/rentalLayoutService"
import { TenantPortalAgendaPage } from "@/features/tenantPortal/pages/TenantPortalAgendaPage"
import {
  bookPortalSlot,
  cancelMyPortalReservation,
  checkPortalAvailability,
  fetchPortalRentalAssets,
  fetchPublicScheduleDay,
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

function renderAgenda() {
  return render(
    <MemoryRouter initialEntries={["/agenda"]}>
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
    toastSuccess.mockReset()
    toastError.mockReset()
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

    await user.click(
      screen.getByRole("button", {
        name: i18n.t("tenantPortal.agenda.cancel"),
      }),
    )

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

    await user.click(
      screen.getByRole("button", {
        name: i18n.t("tenantPortal.agenda.cancel"),
      }),
    )

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
  overrides: Pick<PortalScheduleSlot, "id" | "rentalAssetId" | "assetName" | "startTime" | "endTime">,
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
    toastSuccess.mockReset()
    toastError.mockReset()
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
    const courtTwo = await screen.findByRole("button", { name: "Quadra 2" })
    expect(courtOne).not.toHaveAttribute("aria-disabled")
    expect(courtTwo).toHaveAttribute("aria-disabled", "true")

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
})
