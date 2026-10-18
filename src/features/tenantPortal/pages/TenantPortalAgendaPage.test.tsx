import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  createMemoryRouter,
  MemoryRouter,
  Outlet,
  Route,
  RouterProvider,
  Routes,
} from "react-router-dom"

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
    message: vi.fn(),
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
import {
  customerAlreadyHoldsSlot,
  invalidateAgendaQueries,
  rememberOwnBooking,
  resetAgendaQueryClientForTests,
} from "@/features/tenantPortal/lib/agendaQueryClient"
import {
  BOOKING_HORIZON_EXCEEDED,
  PortalBookingError,
} from "@/features/tenantPortal/lib/portalBookingError"
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
/** 08:00 in America/Sao_Paulo on the fake clock used by the time-selector tests. */
const SLOT_08_ISO = "2026-10-14T11:00:00.000Z"
const VIEWED_DATE = "2026-10-14"
const OTHER_DATE = "2026-10-15"

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
const toastMessage = vi.mocked(toast.message)

beforeEach(() => {
  resetAgendaQueryClientForTests()
})

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

function renderAgendaHistory(
  initialEntries: string[] | string = "/agenda",
) {
  const entries = Array.isArray(initialEntries)
    ? initialEntries
    : [initialEntries]
  const router = createMemoryRouter(
    [
      {
        element: <Outlet context={outletContext} />,
        children: [{ path: "/agenda", element: <TenantPortalAgendaPage /> }],
      },
    ],
    {
      initialEntries: entries,
      initialIndex: entries.length - 1,
    },
  )
  return { router, ...render(<RouterProvider router={router} />) }
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
    toastMessage.mockReset()
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

  it("reports an already cancelled reservation without a success toast", async () => {
    const user = userEvent.setup()
    const confirmed = makeReservation("Confirmed", FUTURE_ISO)
    const canceled = makeReservation("Canceled", FUTURE_ISO)
    let reads = 0
    listMine.mockImplementation(async () => {
      reads += 1
      return reads === 1 ? [confirmed] : [canceled]
    })

    renderAgenda()
    await waitForMineList()
    await confirmCancel(user)

    await waitFor(() => {
      expect(toastMessage).toHaveBeenCalledWith(
        i18n.t("tenantPortal.agenda.alreadyCancelled"),
      )
    })
    expect(cancelMine).not.toHaveBeenCalled()
    expect(toastSuccess).not.toHaveBeenCalled()
    expect(cancelButton()).not.toBeInTheDocument()
  })

  it("shows the already-cancelled message when the agenda revision moves during confirm", async () => {
    const user = userEvent.setup()
    const confirmed = makeReservation("Confirmed", FUTURE_ISO)
    const canceled = makeReservation("Canceled", FUTURE_ISO)
    let releaseConfirmList: (rows: PortalReservation[]) => void = () => {}
    let reads = 0
    listMine.mockImplementation(
      () =>
        new Promise((resolve) => {
          reads += 1
          if (reads === 1) {
            resolve([confirmed])
            return
          }
          if (reads === 2) {
            releaseConfirmList = resolve
            return
          }
          resolve([confirmed])
        }),
    )
    cancelMine.mockResolvedValue(canceled)

    renderAgenda()
    await waitForMineList()
    const dialog = await openCancelDialog(user)
    await user.click(
      within(dialog).getByRole("button", {
        name: i18n.t("tenantPortal.agenda.cancelConfirmAction"),
      }),
    )
    await waitFor(() => {
      expect(listMine).toHaveBeenCalledTimes(2)
    })

    await invalidateAgendaQueries(
      { subdomain: "ficc", dates: ["2099-01-15"] },
      { applySlots: false },
    )
    releaseConfirmList([canceled])

    await waitFor(() => {
      expect(toastMessage).toHaveBeenCalledWith(
        i18n.t("tenantPortal.agenda.alreadyCancelled"),
      )
    })
    expect(toastSuccess).not.toHaveBeenCalled()
    expect(cancelMine).not.toHaveBeenCalled()
  })

  it("keeps a second reservation when the revision moves and confirm sees the booking already cancelled", async () => {
    const user = userEvent.setup()
    const target = makeReservation("Confirmed", FUTURE_ISO)
    const newer = makeReservation("Confirmed", FUTURE_ISO, {
      id: "99999999-9999-4999-8999-999999999999",
      items: [
        {
          ...target.items[0],
          id: "12121212-1212-4121-8121-121212121212",
          assetName: "Sala nova",
        },
      ],
    })
    const canceled = makeReservation("Canceled", FUTURE_ISO)
    let releaseConfirmList: (rows: PortalReservation[]) => void = () => {}
    let reads = 0
    listMine.mockImplementation(
      () =>
        new Promise((resolve) => {
          reads += 1
          if (reads === 1) {
            resolve([target])
            return
          }
          if (reads === 2) {
            releaseConfirmList = resolve
            return
          }
          resolve([canceled, newer])
        }),
    )

    renderAgenda()
    await waitForMineList()
    const dialog = await openCancelDialog(user)
    await user.click(
      within(dialog).getByRole("button", {
        name: i18n.t("tenantPortal.agenda.cancelConfirmAction"),
      }),
    )
    await waitFor(() => {
      expect(listMine).toHaveBeenCalledTimes(2)
    })

    await invalidateAgendaQueries(
      { subdomain: "ficc", dates: ["2099-01-15"] },
      { applySlots: false },
    )
    expect(await screen.findByText("Sala nova")).toBeInTheDocument()

    releaseConfirmList([canceled])

    await waitFor(() => {
      expect(toastMessage).toHaveBeenCalledWith(
        i18n.t("tenantPortal.agenda.alreadyCancelled"),
      )
    })
    expect(toastSuccess).not.toHaveBeenCalled()
    expect(cancelMine).not.toHaveBeenCalled()
    expect(screen.getByText("Sala nova")).toBeInTheDocument()
    expect(screen.getByText(/Cancelada/)).toBeInTheDocument()
  })

  it("clears the held-slot key when confirm sees the booking already cancelled", async () => {
    const user = userEvent.setup()
    const confirmed = makeReservation("Confirmed", FUTURE_ISO)
    const canceled = makeReservation("Canceled", FUTURE_ISO)
    rememberOwnBooking(confirmed)
    expect(
      customerAlreadyHoldsSlot(
        "2099-01-15",
        "11111111-1111-4111-8111-111111111111",
        "10:00",
        [],
      ),
    ).toBe(true)
    let reads = 0
    listMine.mockImplementation(async () => {
      reads += 1
      return reads === 1 ? [confirmed] : [canceled]
    })

    renderAgenda()
    await waitForMineList()
    await confirmCancel(user)

    await waitFor(() => {
      expect(toastMessage).toHaveBeenCalledWith(
        i18n.t("tenantPortal.agenda.alreadyCancelled"),
      )
    })
    expect(
      customerAlreadyHoldsSlot(
        "2099-01-15",
        "11111111-1111-4111-8111-111111111111",
        "10:00",
        [],
      ),
    ).toBe(false)
  })

  it("keeps a reservation from a newer refresh when the cancel list is stale", async () => {
    const user = userEvent.setup()
    const target = makeReservation("Confirmed", FUTURE_ISO)
    const newer = makeReservation("Confirmed", FUTURE_ISO, {
      id: "99999999-9999-4999-8999-999999999999",
      items: [
        {
          ...target.items[0],
          id: "12121212-1212-4121-8121-121212121212",
          assetName: "Sala nova",
        },
      ],
    })
    let releaseStale: (rows: PortalReservation[]) => void = () => {}
    let reads = 0
    listMine.mockImplementation(
      () =>
        new Promise((resolve) => {
          reads += 1
          if (reads === 1) {
            resolve([target])
            return
          }
          if (reads === 2) {
            releaseStale = resolve
            return
          }
          resolve([target, newer])
        }),
    )
    cancelMine.mockResolvedValue({ ...target, status: "Canceled" })

    renderAgenda()
    await waitForMineList()
    const dialog = await openCancelDialog(user)
    await user.click(
      within(dialog).getByRole("button", {
        name: i18n.t("tenantPortal.agenda.cancelConfirmAction"),
      }),
    )
    await waitFor(() => {
      expect(listMine).toHaveBeenCalledTimes(2)
    })

    await invalidateAgendaQueries(
      { subdomain: "ficc", dates: ["2099-01-15"] },
      { applySlots: false },
    )
    expect(await screen.findByText("Sala nova")).toBeInTheDocument()

    releaseStale([target])
    await waitFor(() => {
      expect(cancelMine).toHaveBeenCalledWith(target.id)
    })
    expect(screen.getByText("Sala nova")).toBeInTheDocument()
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
    expect(policy).not.toHaveTextContent(
      i18n.t("tenantPortal.agenda.cancellationPolicyDefault"),
    )
    expect(policy.innerHTML).not.toContain("<img")
    expect(policy.innerHTML).not.toContain("<script")
    expect(policy.querySelector("img")).toBeNull()
    expect(policy.querySelector("script")).toBeNull()
  })

  it("shows a neutral default when the tenant has no cancellation text", async () => {
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
      within(dialog).getByTestId("cancellation-policy-text"),
    ).toHaveTextContent(i18n.t("tenantPortal.agenda.cancellationPolicyDefault"))
    expect(
      enCommon.tenantPortal.agenda.cancellationPolicyDefault.trim().length,
    ).toBeGreaterThan(20)
    expect(
      esCommon.tenantPortal.agenda.cancellationPolicyDefault.trim().length,
    ).toBeGreaterThan(20)
    expect(
      ptBRCommon.tenantPortal.agenda.cancellationPolicyDefault.trim().length,
    ).toBeGreaterThan(20)
  })

  it("shows the neutral default when the public policy request fails", async () => {
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
      within(dialog).getByTestId("cancellation-policy-text"),
    ).toHaveTextContent(i18n.t("tenantPortal.agenda.cancellationPolicyDefault"))
    expect(toastError).not.toHaveBeenCalledWith("policy down")
  })

  it("clears Cancelando and shows the canceled reservation before refresh settles", async () => {
    const user = userEvent.setup()
    const canceled = makeReservation("Canceled", FUTURE_ISO)
    let listCalls = 0
    listMine.mockImplementation(() => {
      listCalls += 1
      // The confirm path reads the list once before cancelling. Later reads are
      // the refresh and must not be required for the success toast.
      if (listCalls <= 2) {
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
      if (listCalls <= 2) {
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
    toastMessage.mockReset()
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

  it("refetches reservations and the viewed day on focus, then disables a taken slot", async () => {
    const user = userEvent.setup()
    renderAgenda()

    const court = await screen.findByRole("button", { name: "Quadra 1" })
    await user.click(court)
    const reserve = screen.getByRole("button", {
      name: i18n.t("tenantPortal.agenda.reserveSlot"),
    })
    await waitFor(() => {
      expect(reserve).toBeEnabled()
    })

    const mineBefore = listMine.mock.calls.length
    const dayBefore = fetchDay.mock.calls.length
    fetchDay.mockResolvedValue({
      date: "2026-10-14",
      slots: [
        makeSlot({
          id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1",
          rentalAssetId: ASSET_A_ID,
          assetName: "Quadra 1",
          startTime: "08:00:00",
          endTime: "09:00:00",
          status: "booked",
          isBookableByCustomer: false,
          reservationId: "99999999-9999-4999-8999-999999999999",
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

    vi.setSystemTime(new Date("2026-10-14T08:00:03.000Z"))
    act(() => {
      window.dispatchEvent(new Event("focus"))
    })

    await waitFor(() => {
      expect(listMine.mock.calls.length).toBeGreaterThan(mineBefore)
      expect(fetchDay.mock.calls.length).toBeGreaterThan(dayBefore)
    })
    await waitFor(() => {
      expect(reserve).toBeDisabled()
    })
    expect(
      screen.getByRole("button", {
        name: `Quadra 1. ${i18n.t("tenantPortal.agenda.slotTaken")}`,
      }),
    ).toHaveAttribute("aria-disabled", "true")

    const mineAfter = listMine.mock.calls.length
    const dayAfter = fetchDay.mock.calls.length
    act(() => {
      window.dispatchEvent(new Event("focus"))
      document.dispatchEvent(new Event("visibilitychange"))
    })
    await act(async () => {
      await Promise.resolve()
    })
    expect(listMine.mock.calls.length).toBe(mineAfter)
    expect(fetchDay.mock.calls.length).toBe(dayAfter)
  })

  it("selects a later time and keeps unavailable courts distinguishable", async () => {
    const user = userEvent.setup()
    renderAgenda()

    const courtOne = await screen.findByRole("button", { name: "Quadra 1" })
    const courtTwo = await screen.findByRole("button", {
      name: `Quadra 2. ${i18n.t("tenantPortal.agenda.slotTaken")}`,
    })
    expect(courtOne).not.toHaveAttribute("aria-disabled")
    expect(courtTwo).toHaveAttribute("aria-disabled", "true")
    expect(courtTwo).toHaveTextContent(i18n.t("tenantPortal.agenda.slotTaken"))

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

  it("disables Reservar horário while the price is still calculating", async () => {
    let resolveQuote: (value: {
      isAvailable: boolean
      requestedQuantity: number
      availableQuantity: number
      estimatedTotalAmount: number
      reason: null
    }) => void = () => {}
    checkAvailability.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveQuote = resolve
        }),
    )
    const user = userEvent.setup()
    renderAgenda()

    await user.click(await screen.findByRole("button", { name: "Quadra 1" }))

    expect(
      await screen.findByText(i18n.t("tenantPortal.agenda.quoteLoading")),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", {
        name: i18n.t("tenantPortal.agenda.reserveSlot"),
      }),
    ).toBeDisabled()

    resolveQuote({
      isAvailable: true,
      requestedQuantity: 1,
      availableQuantity: 1,
      estimatedTotalAmount: 80,
      reason: null,
    })

    expect(
      await screen.findByText(
        i18n.t("tenantPortal.agenda.available", {
          amount: formatMoney(80),
        }),
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", {
        name: i18n.t("tenantPortal.agenda.reserveSlot"),
      }),
    ).toBeEnabled()
    expect(
      screen.queryByText(i18n.t("tenantPortal.agenda.quoteLoading")),
    ).not.toBeInTheDocument()
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
    const created = makeReservation("Confirmed", SLOT_08_ISO, {
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
        name: `Quadra 1. ${i18n.t("tenantPortal.agenda.slotTaken")}`,
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
    bookSlot.mockResolvedValue(makeReservation("Confirmed", SLOT_08_ISO))
    renderAgenda()

    await bookQuadra1(user)

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalled()
    })
    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith("schedule down")
    })
    expect(toastError).toHaveBeenCalledTimes(1)
    expect(dayCalls).toBe(3)
    expect(
      screen.queryByRole("button", {
        name: i18n.t("tenantPortal.agenda.reserving"),
      }),
    ).not.toBeInTheDocument()
    expect(screen.getAllByText("Quadra 1").length).toBeGreaterThan(0)
  })

  it("refetches the list and the slot after Back during Reservando", async () => {
    const user = userEvent.setup()
    const created = makeReservation("Confirmed", SLOT_08_ISO, {
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
    let phase: "stale" | "fresh" = "stale"
    let resolveBook: (value: PortalReservation) => void = () => {}
    bookSlot.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveBook = resolve
        }),
    )
    listMine.mockImplementation(async () => (phase === "fresh" ? [created] : []))
    fetchDay.mockImplementation(async () => ({
      date: "2026-10-14",
      slots: [
        makeSlot({
          id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1",
          rentalAssetId: ASSET_A_ID,
          assetName: "Quadra 1",
          startTime: "08:00:00",
          endTime: "09:00:00",
          ...(phase === "fresh"
            ? {
                status: "booked",
                isBookableByCustomer: false,
                reservationId: created.id,
              }
            : {}),
        }),
      ],
    }))

    const first = renderAgenda()
    await bookQuadra1(user)
    expect(
      await screen.findByRole("button", {
        name: i18n.t("tenantPortal.agenda.reserving"),
      }),
    ).toBeInTheDocument()
    first.unmount()

    renderAgenda()
    await waitFor(() => {
      expect(
        screen.getByRole("combobox", {
          name: i18n.t("tenantPortal.agenda.time"),
        }),
      ).toHaveTextContent("08:00")
    })
    expect(screen.getByText(i18n.t("tenantPortal.agenda.empty"))).toBeInTheDocument()
    const callsBeforeSettle = fetchDay.mock.calls.length
    phase = "fresh"
    await act(async () => {
      resolveBook(created)
    })

    await waitFor(() => {
      expect(fetchDay.mock.calls.length).toBeGreaterThan(callsBeforeSettle)
    })
    expect(await screen.findByRole("listitem")).toHaveTextContent(
      i18n.t("rentals.reservations.statuses.Confirmed"),
    )
    expect(
      screen.getByRole("button", {
        name: `Quadra 1. ${i18n.t("tenantPortal.agenda.slotTaken")}`,
      }),
    ).toBeInTheDocument()
  })

  it("shows the in-flight reservation after Back when the list read is still empty", async () => {
    const user = userEvent.setup()
    const created = makeReservation("Confirmed", SLOT_08_ISO, {
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
    let resolveBook: (value: PortalReservation) => void = () => undefined
    bookSlot.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveBook = resolve
        }),
    )
    listMine.mockResolvedValue([])
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
      ],
    })

    const first = renderAgenda()
    await bookQuadra1(user)
    expect(
      await screen.findByRole("button", {
        name: i18n.t("tenantPortal.agenda.reserving"),
      }),
    ).toBeInTheDocument()
    first.unmount()

    renderAgenda()
    const taken = await screen.findByRole("button", {
      name: `Quadra 1. ${i18n.t("tenantPortal.agenda.slotTaken")}`,
    })
    expect(taken).toHaveAttribute("aria-disabled", "true")
    expect(bookSlot).toHaveBeenCalledTimes(1)
    await act(async () => {
      resolveBook(created)
    })

    expect(await screen.findByRole("listitem")).toHaveTextContent(
      i18n.t("rentals.reservations.statuses.Confirmed"),
    )
    expect(bookSlot).toHaveBeenCalledTimes(1)
  })

  it("explains a horizon rejection from the booking request", async () => {
    const user = userEvent.setup()
    bookSlot.mockRejectedValue(
      new PortalBookingError(
        "A data solicitada está além do horizonte de reserva.",
        400,
        BOOKING_HORIZON_EXCEEDED,
      ),
    )
    renderAgenda()

    await bookQuadra1(user)

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith(
        i18n.t("tenantPortal.agenda.horizonExceeded"),
      )
    })
    expect(
      screen.getByRole("button", {
        name: i18n.t("tenantPortal.agenda.reserveSlot"),
      }),
    ).toBeEnabled()
  })

  it("keeps the slot taken after Back even when the day still lists it as free", async () => {
    const user = userEvent.setup()
    const created = makeReservation("Confirmed", SLOT_08_ISO, {
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
    let resolveBook: (value: PortalReservation) => void = () => {}
    bookSlot.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveBook = resolve
        }),
    )

    const first = renderAgenda()
    await bookQuadra1(user)
    first.unmount()
    renderAgenda()
    expect(
      await screen.findByRole("button", {
        name: `Quadra 1. ${i18n.t("tenantPortal.agenda.slotTaken")}`,
      }),
    ).toHaveAttribute("aria-disabled", "true")
    expect(screen.queryByRole("button", { name: "Quadra 1" })).not.toBeInTheDocument()
    await act(async () => {
      resolveBook(created)
    })
    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalled()
    })

    expect(bookSlot).toHaveBeenCalledTimes(1)
    expect(
      screen.getByRole("button", {
        name: `Quadra 1. ${i18n.t("tenantPortal.agenda.slotTaken")}`,
      }),
    ).toHaveAttribute("aria-disabled", "true")
    expect(toastError).not.toHaveBeenCalled()
  })

  it("recognises a reservation made in another tab instead of saying someone else took it", async () => {
    const user = userEvent.setup()
    const held = makeReservation("Confirmed", SLOT_08_ISO, {
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
    let mineCalls = 0
    listMine.mockImplementation(async () => {
      mineCalls += 1
      return mineCalls === 1 ? [] : [held]
    })
    bookSlot.mockRejectedValue(
      new PortalBookingError(
        "O local 'Sala 1' não está disponível para o intervalo solicitado.",
        409,
        null,
      ),
    )

    renderAgenda()
    await bookQuadra1(user)

    await waitFor(() => {
      expect(toastError).toHaveBeenCalled()
    })
    const notice = toastError.mock.calls.at(-1)?.[0]
    const view = render(<>{notice}</>)
    expect(
      view.getByRole("link", {
        name: i18n.t("tenantPortal.agenda.myReservations"),
      }),
    ).toBeInTheDocument()
    expect(view.container).toHaveTextContent(
      i18n.t("tenantPortal.agenda.slotHeldByYou"),
    )
    expect(toastError.mock.calls.map((call) => call[0])).not.toContain(
      i18n.t("tenantPortal.agenda.slotTaken"),
    )
  })

  it("keeps the date and time from the address across a reload", async () => {
    fetchDay.mockImplementation(async (_subdomain: string, dayDate: string) =>
      Promise.resolve({
        date: dayDate,
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
      }),
    )

    renderAgenda("/agenda?date=2026-10-20&time=13:00")

    expect(
      await screen.findByLabelText(i18n.t("tenantPortal.agenda.date")),
    ).toHaveValue("2026-10-20")
    await waitFor(() => {
      expect(fetchDay).toHaveBeenCalledWith("ficc", "2026-10-20")
    })
    expect(
      screen.getByRole("combobox", {
        name: i18n.t("tenantPortal.agenda.time"),
      }),
    ).toHaveTextContent("13:00")
    expect(
      screen.queryByRole("option", { name: "08:00 – 09:00" }),
    ).not.toBeInTheDocument()
  })

  it("falls back to today and the first time when the address has no choice", async () => {
    renderAgenda("/agenda?date=2020-01-01&time=99:00")

    const dateInput = await screen.findByLabelText(
      i18n.t("tenantPortal.agenda.date"),
    )
    expect(dateInput).toHaveValue(brazilTodayIsoDate())
    await waitFor(() => {
      expect(
        screen.getByRole("combobox", {
          name: i18n.t("tenantPortal.agenda.time"),
        }),
      ).toHaveTextContent("08:00")
    })
    expect(fetchDay).not.toHaveBeenCalledWith("ficc", "2020-01-01")
  })

  it("does not offer a date before today in America/Sao_Paulo", async () => {
    renderAgenda()

    const dateInput = await screen.findByLabelText(
      i18n.t("tenantPortal.agenda.date"),
    )
    expect(dateInput).toHaveAttribute("min", brazilTodayIsoDate())
    expect(dateInput).not.toHaveAttribute("max")
    expect(dateInput).toHaveValue(brazilTodayIsoDate())
  })

  it("caps the date at the horizon the API exposes", async () => {
    fetchPolicy.mockResolvedValue({
      cancellationPolicyText: null,
      maxActiveReservationsPerCustomerPerDay: null,
      maxAdvanceBookingDays: 2,
    })
    renderAgenda()

    const dateInput = await screen.findByLabelText(
      i18n.t("tenantPortal.agenda.date"),
    )
    await waitFor(() => {
      expect(dateInput).toHaveAttribute("max", "2026-10-16")
    })

    expect(
      screen.getByText(
        i18n.t("tenantPortal.agenda.horizonHint", {
          date: "16/10",
          count: 2,
        }),
      ),
    ).toBeInTheDocument()

    fireEvent.change(dateInput, { target: { value: "2099-12-31" } })

    expect(dateInput).toHaveValue("2026-10-14")
    expect(dateInput).toHaveAttribute("aria-invalid", "true")
    expect(fetchDay).not.toHaveBeenCalledWith("ficc", "2099-12-31")
    expect(
      screen.getByText(i18n.t("tenantPortal.agenda.horizonExceeded")),
    ).toBeInTheDocument()
    expect(
      screen.queryByText(i18n.t("tenantPortal.agenda.horizonAdjusted")),
    ).not.toBeInTheDocument()
  })

  it("does not cap the date when the horizon is unlimited", async () => {
    fetchPolicy.mockResolvedValue({
      cancellationPolicyText: null,
      maxActiveReservationsPerCustomerPerDay: null,
      maxAdvanceBookingDays: null,
    })
    renderAgenda()

    const dateInput = await screen.findByLabelText(
      i18n.t("tenantPortal.agenda.date"),
    )
    await waitFor(() => {
      expect(fetchPolicy).toHaveBeenCalled()
    })
    expect(dateInput).not.toHaveAttribute("max")
    expect(
      screen.queryByText(/dias à frente|days ahead|días adelante/),
    ).not.toBeInTheDocument()
  })

  it("keeps a chosen date when the field is cleared or set before today", async () => {
    renderAgenda("/agenda?date=2026-10-20")
    const dateInput = await screen.findByLabelText(
      i18n.t("tenantPortal.agenda.date"),
    )
    await waitFor(() => {
      expect(dateInput).toHaveValue("2026-10-20")
    })

    fireEvent.change(dateInput, { target: { value: "" } })
    expect(dateInput).toHaveValue("2026-10-20")

    fireEvent.change(dateInput, { target: { value: "2020-01-01" } })
    expect(dateInput).toHaveValue("2026-10-20")
    expect(
      screen.getByText(i18n.t("tenantPortal.agenda.dateBeforeToday")),
    ).toBeInTheDocument()
    expect(fetchDay).not.toHaveBeenCalledWith("ficc", "2020-01-01")
  })

  it("explains a disabled calendar day without moving the selection", async () => {
    fetchPolicy.mockResolvedValue({
      cancellationPolicyText: null,
      maxActiveReservationsPerCustomerPerDay: null,
      maxAdvanceBookingDays: 2,
    })
    const user = userEvent.setup()
    renderAgenda("/agenda?date=2026-10-15")
    const dateInput = await screen.findByLabelText(
      i18n.t("tenantPortal.agenda.date"),
    )
    await waitFor(() => {
      expect(dateInput).toHaveAttribute("max", "2026-10-16")
    })

    await user.click(dateInput)
    await user.click(await screen.findByRole("button", { name: "31/10/2026" }))

    expect(dateInput).toHaveValue("2026-10-15")
    expect(
      screen.getByText(i18n.t("tenantPortal.agenda.horizonExceeded")),
    ).toBeInTheDocument()
    expect(fetchDay).not.toHaveBeenCalledWith("ficc", "2026-10-31")
  })

  it("keeps the URL date after cancelling a booking", async () => {
    const user = userEvent.setup()
    const reservedIso = "2026-10-15T11:00:00.000Z"
    listMine.mockResolvedValue([makeReservation("Confirmed", reservedIso)])
    cancelMine.mockResolvedValue(makeReservation("Canceled", reservedIso))
    const { router } = renderAgendaHistory("/agenda?date=2026-10-15")

    const dateInput = await screen.findByLabelText(
      i18n.t("tenantPortal.agenda.date"),
    )
    await waitFor(() => {
      expect(dateInput).toHaveValue("2026-10-15")
      expect(router.state.location.search).toContain("date=2026-10-15")
    })

    await confirmCancel(user)

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith(
        i18n.t("tenantPortal.agenda.cancelSuccess"),
      )
    })
    expect(dateInput).toHaveValue("2026-10-15")
    expect(router.state.location.search).toContain("date=2026-10-15")
    expect(router.state.location.search).not.toMatch(/date=2026-10-14/)
  })

  it("shows the horizon message when the day request is rejected", async () => {
    fetchDay.mockRejectedValue(
      new PortalBookingError(
        "A data solicitada está além do horizonte de reserva.",
        400,
        BOOKING_HORIZON_EXCEEDED,
      ),
    )
    renderAgenda()

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith(
        i18n.t("tenantPortal.agenda.horizonExceeded"),
      )
    })
    expect(toastError).not.toHaveBeenCalledWith(
      i18n.t("tenantPortal.agenda.slotsError"),
    )
  })

  it("does not request a date past the horizon before the public policy resolves", async () => {
    let releasePolicy: (policy: {
      cancellationPolicyText: null
      maxActiveReservationsPerCustomerPerDay: null
      maxAdvanceBookingDays: number
    }) => void = () => {}
    fetchPolicy.mockImplementation(
      () =>
        new Promise((resolve) => {
          releasePolicy = resolve
        }),
    )
    renderAgenda("/agenda?date=2099-12-31")

    expect(
      await screen.findByLabelText(i18n.t("tenantPortal.agenda.date")),
    ).toBeInTheDocument()
    expect(fetchDay).not.toHaveBeenCalled()

    await act(async () => {
      releasePolicy({
        cancellationPolicyText: null,
        maxActiveReservationsPerCustomerPerDay: null,
        maxAdvanceBookingDays: 2,
      })
    })

    await waitFor(() => {
      expect(fetchDay).toHaveBeenCalledWith("ficc", "2026-10-16")
    })
    expect(fetchDay.mock.calls.map((call) => call[1])).not.toContain("2099-12-31")
    expect(
      screen.getByLabelText(i18n.t("tenantPortal.agenda.date")),
    ).toHaveValue("2026-10-16")
  })

  it("does not request an impossible civil date", async () => {
    renderAgenda("/agenda?date=2026-11-31")

    expect(
      await screen.findByLabelText(i18n.t("tenantPortal.agenda.date")),
    ).toHaveValue("2026-10-14")
    await waitFor(() => {
      expect(fetchDay).toHaveBeenCalledWith("ficc", "2026-10-14")
    })
    expect(fetchDay.mock.calls.map((call) => call[1])).not.toContain("2026-11-31")
  })

  it("restores the previous date when the browser goes back", async () => {
    const { router } = renderAgendaHistory()
    const dateInput = await screen.findByLabelText(
      i18n.t("tenantPortal.agenda.date"),
    )
    expect(dateInput).toHaveValue("2026-10-14")
    await waitFor(() => {
      expect(fetchDay).toHaveBeenCalledWith("ficc", "2026-10-14")
    })

    fireEvent.change(dateInput, { target: { value: "2026-10-20" } })
    await waitFor(() => {
      expect(dateInput).toHaveValue("2026-10-20")
      expect(fetchDay).toHaveBeenCalledWith("ficc", "2026-10-20")
    })

    await act(async () => {
      await router.navigate(-1)
    })

    await waitFor(() => {
      expect(
        screen.getByLabelText(i18n.t("tenantPortal.agenda.date")),
      ).toHaveValue("2026-10-14")
    })
    expect(
      screen.getByRole("combobox", { name: i18n.t("tenantPortal.agenda.time") }),
    ).toHaveTextContent("08:00")
  })

  it("replaces a beyond-horizon deep link so Back reaches the earlier entry", async () => {
    fetchPolicy.mockResolvedValue({
      cancellationPolicyText: null,
      maxActiveReservationsPerCustomerPerDay: null,
      maxAdvanceBookingDays: 2,
    })
    const { router } = renderAgendaHistory([
      "/agenda?date=2026-10-15",
      "/agenda?date=2099-12-31&time=08:00",
    ])

    await waitFor(() => {
      expect(
        screen.getByLabelText(i18n.t("tenantPortal.agenda.date")),
      ).toHaveValue("2026-10-16")
      expect(router.state.location.search).not.toContain("2099-12-31")
    })
    expect(
      screen.getByLabelText(i18n.t("tenantPortal.agenda.date")),
    ).not.toHaveAttribute("aria-invalid")
    expect(
      screen.getByText(i18n.t("tenantPortal.agenda.horizonAdjusted")),
    ).toBeInTheDocument()
    expect(fetchDay.mock.calls.map((call) => call[1])).not.toContain(
      "2099-12-31",
    )

    await act(async () => {
      await router.navigate(-1)
    })

    await waitFor(() => {
      expect(
        screen.getByLabelText(i18n.t("tenantPortal.agenda.date")),
      ).toHaveValue("2026-10-15")
    })
    expect(router.state.location.search).toContain("date=2026-10-15")
    expect(router.state.location.search).not.toContain("2099-12-31")
  })

  it("drops the previous grid while a later day waits on policy", async () => {
    fetchPolicy.mockImplementation(() => new Promise(() => {}))
    const user = userEvent.setup()
    renderAgenda()

    await user.click(await screen.findByRole("button", { name: "Quadra 1" }))
    await waitFor(() => {
      expect(checkAvailability).toHaveBeenCalledWith(
        "ficc",
        expect.objectContaining({ date: "2026-10-14", startTime: "08:00" }),
      )
    })
    const quotesBefore = checkAvailability.mock.calls.length

    fireEvent.change(
      screen.getByLabelText(i18n.t("tenantPortal.agenda.date")),
      { target: { value: "2026-10-20" } },
    )

    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: "Quadra 1" }),
      ).not.toBeInTheDocument()
    })
    expect(
      screen.queryByRole("button", {
        name: `Quadra 1. ${i18n.t("tenantPortal.agenda.slotTaken")}`,
      }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole("button", {
        name: `Quadra 1. ${i18n.t("common.refreshing")}`,
      }),
    ).toHaveAttribute("aria-busy", "true")
    expect(
      screen.getByRole("button", {
        name: i18n.t("tenantPortal.agenda.reserveSlot"),
      }),
    ).toBeDisabled()
    expect(checkAvailability).toHaveBeenCalledTimes(quotesBefore)
    expect(
      checkAvailability.mock.calls.some(
        (call) =>
          typeof call[1] === "object" &&
          call[1] !== null &&
          "date" in call[1] &&
          call[1].date === "2026-10-20",
      ),
    ).toBe(false)
    expect(fetchDay).not.toHaveBeenCalledWith("ficc", "2026-10-20")
  })

  it("formats the booking total and the estimate for each locale", async () => {
    listMine.mockResolvedValue([makeReservation("Confirmed", FUTURE_ISO)])
    const user = userEvent.setup()
    renderAgenda()

    expect(await screen.findByRole("listitem")).toHaveTextContent("Total R$ 80,00")
    await user.click(await screen.findByRole("button", { name: "Quadra 1" }))
    expect(
      await screen.findByText("Disponível. Estimativa: R$ 80,00"),
    ).toBeInTheDocument()

    try {
      await i18n.changeLanguage("en")
      expect(screen.getByRole("listitem")).toHaveTextContent("Total R$ 80.00")
      expect(screen.getByRole("listitem")).not.toHaveTextContent("80,00")
      expect(
        screen.getByText("Available. Estimate: R$ 80.00"),
      ).toBeInTheDocument()

      await i18n.changeLanguage("es")
      expect(screen.getByRole("listitem")).toHaveTextContent("Total 80,00 R$")
      expect(screen.getByRole("listitem")).not.toHaveTextContent("R$ 80.00")
      expect(
        screen.getByText("Disponible. Estimación: 80,00 R$"),
      ).toBeInTheDocument()
    } finally {
      await i18n.changeLanguage("pt-BR")
    }
  })

  it("explains a horizon rejection from the price estimate in Spanish", async () => {
    checkAvailability.mockRejectedValue(
      new PortalBookingError(
        "A data solicitada está além do horizonte de reserva.",
        400,
        BOOKING_HORIZON_EXCEEDED,
      ),
    )
    const user = userEvent.setup()
    renderAgenda()

    try {
      await i18n.changeLanguage("es")
      await user.click(await screen.findByRole("button", { name: "Quadra 1" }))
      await waitFor(() => {
        expect(toastError).toHaveBeenCalledWith(
          "La fecha pedida está fuera del horizonte de reserva.",
        )
      })
      expect(toastError).not.toHaveBeenCalledWith(
        i18n.t("tenantPortal.agenda.availabilityError"),
      )
    } finally {
      await i18n.changeLanguage("pt-BR")
    }
  })

  it("says times, not slots, when the day cannot be loaded in English", async () => {
    fetchDay.mockRejectedValue(new Error("network"))
    renderAgenda()

    try {
      await i18n.changeLanguage("en")
      const trigger = await screen.findByRole("combobox", {
        name: i18n.t("tenantPortal.agenda.time"),
      })
      await waitFor(() => {
        expect(trigger).toHaveTextContent("Could not load times for this day.")
      })
      expect(trigger.textContent ?? "").not.toMatch(/slots/i)
    } finally {
      await i18n.changeLanguage("pt-BR")
    }
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

    expect(dateInput).toHaveValue(brazilTodayIsoDate())
    expect(
      screen.getByText(i18n.t("tenantPortal.agenda.dateBeforeToday")),
    ).toBeInTheDocument()
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
        i18n.t("tenantPortal.agenda.slotTaken"),
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
      i18n.t("tenantPortal.agenda.slotTaken"),
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
      i18n.t("tenantPortal.agenda.slotTaken"),
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
      name: `Quadra 2. ${i18n.t("tenantPortal.agenda.slotTaken")}`,
    })
    expect(taken).toHaveAttribute("aria-disabled", "true")
    expect(taken).toHaveTextContent(i18n.t("tenantPortal.agenda.slotTaken"))
    expect(taken).not.toHaveAttribute(
      "title",
      i18n.t("tenantPortal.agenda.slotTaken"),
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
      name: `Quadra 2. ${i18n.t("tenantPortal.agenda.slotTaken")}`,
    })
    expect(taken).toHaveAttribute("aria-disabled", "true")
    expect(taken).toHaveTextContent(i18n.t("tenantPortal.agenda.slotTaken"))
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
      name: `Quadra 2. ${i18n.t("tenantPortal.agenda.slotTaken")}`,
    })
    expect(taken).toHaveTextContent(i18n.t("tenantPortal.agenda.slotTaken"))
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
      name: `Quadra 2. ${i18n.t("tenantPortal.agenda.slotTaken")}`,
    })
    expect(unplaced.className).toContain("bg-muted")
    expect(unplaced.className).toContain("text-foreground")
    expect(unplaced).toHaveTextContent(i18n.t("tenantPortal.agenda.slotTaken"))
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
        i18n.t("tenantPortal.agenda.slotTaken"),
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
        name: `Quadra 1. ${i18n.t("tenantPortal.agenda.slotTaken")}`,
      }),
    ).toHaveTextContent(i18n.t("tenantPortal.agenda.slotTaken"))
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
      i18n.t("tenantPortal.agenda.slotTaken"),
    )
    const card = screen.getByRole("button", {
      name: `Quadra 1. ${i18n.t("tenantPortal.agenda.slotTaken")}`,
    })
    expect(card).toHaveAttribute("aria-disabled", "true")
    expect(card).toHaveTextContent(i18n.t("tenantPortal.agenda.slotTaken"))
  })

  it("clears the reserved mark when this browser's booking is canceled", async () => {
    const user = userEvent.setup()
    const created = makeReservation("Confirmed", SLOT_08_ISO)
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
    cancelMine.mockResolvedValue(makeReservation("Canceled", SLOT_08_ISO))
    renderAgenda()

    await bookQuadra1(user)

    expect(
      await screen.findByRole("button", {
        name: `Quadra 1. ${i18n.t("tenantPortal.agenda.slotTaken")}`,
      }),
    ).toBeInTheDocument()

    await confirmCancel(user)

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith(
        i18n.t("tenantPortal.agenda.cancelSuccess"),
      )
    })
    expect(
      screen.queryByRole("button", { name: "Quadra 1" }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole("button", {
        name: `Quadra 1. ${i18n.t("tenantPortal.agenda.slotTaken")}`,
      }),
    ).toHaveAttribute("aria-disabled", "true")
    expect(dayCalls).toBeGreaterThanOrEqual(2)
  })

  function agendaSlot(
    rentalAssetId: string,
    assetName: string,
    overrides: Partial<PortalScheduleSlot> = {},
  ): PortalScheduleSlot {
    return makeSlot({
      id:
        rentalAssetId === ASSET_A_ID
          ? "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1"
          : "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2",
      rentalAssetId,
      assetName,
      startTime: "08:00:00",
      endTime: "09:00:00",
      ...overrides,
    })
  }

  function heldQuadra1(): PortalScheduleSlot {
    return agendaSlot(ASSET_A_ID, "Quadra 1", {
      status: "booked",
      isBookableByCustomer: false,
      reservationId: RESERVATION_ID,
    })
  }

  function freeQuadra1(): PortalScheduleSlot {
    return agendaSlot(ASSET_A_ID, "Quadra 1")
  }

  function freeQuadra2(): PortalScheduleSlot {
    return agendaSlot(ASSET_B_ID, "Quadra 2")
  }

  async function expectQuadra1Selectable() {
    const court = await screen.findByRole("button", { name: "Quadra 1" })
    expect(court).toBeEnabled()
    expect(court).not.toHaveTextContent(i18n.t("tenantPortal.agenda.slotTaken"))
  }

  it("frees the slot after reserve and cancel in the same session", async () => {
    const user = userEvent.setup()
    let dayCalls = 0
    fetchDay.mockImplementation(() => {
      dayCalls += 1
      if (dayCalls === 1) {
        return Promise.resolve({
          date: VIEWED_DATE,
          slots: [freeQuadra1(), freeQuadra2()],
        })
      }
      if (dayCalls === 2) {
        return Promise.resolve({
          date: VIEWED_DATE,
          slots: [heldQuadra1(), freeQuadra2()],
        })
      }
      return Promise.resolve({
        date: VIEWED_DATE,
        slots: [freeQuadra1(), freeQuadra2()],
      })
    })
    bookSlot.mockResolvedValue(makeReservation("Confirmed", SLOT_08_ISO))
    cancelMine.mockResolvedValue(makeReservation("Canceled", SLOT_08_ISO))
    renderAgenda()

    await bookQuadra1(user)
    expect(
      await screen.findByRole("button", {
        name: `Quadra 1. ${i18n.t("tenantPortal.agenda.slotTaken")}`,
      }),
    ).toBeInTheDocument()
    await waitFor(() => {
      expect(dayCalls).toBeGreaterThanOrEqual(2)
    })

    await confirmCancel(user)
    await expectQuadra1Selectable()
    expect(toastError).not.toHaveBeenCalled()
  })

  it("frees a slot loaded from the server after a remount", async () => {
    let released = false
    fetchDay.mockImplementation(() =>
      Promise.resolve({
        date: VIEWED_DATE,
        slots: released
          ? [freeQuadra1(), freeQuadra2()]
          : [heldQuadra1(), freeQuadra2()],
      }),
    )
    listMine.mockImplementation(() =>
      Promise.resolve([
        makeReservation(released ? "Canceled" : "Confirmed", SLOT_08_ISO),
      ]),
    )
    cancelMine.mockResolvedValue(makeReservation("Canceled", SLOT_08_ISO))
    const user = userEvent.setup()

    const first = renderAgenda()
    expect(
      await screen.findByRole("button", {
        name: `Quadra 1. ${i18n.t("tenantPortal.agenda.slotTaken")}`,
      }),
    ).toBeInTheDocument()
    first.unmount()

    renderAgenda()
    expect(
      await screen.findByRole("button", {
        name: `Quadra 1. ${i18n.t("tenantPortal.agenda.slotTaken")}`,
      }),
    ).toBeInTheDocument()

    released = true
    await confirmCancel(user)
    await expectQuadra1Selectable()
  })

  it("frees the slot after a language switch without refetching the day", async () => {
    let released = false
    fetchDay.mockImplementation(() =>
      Promise.resolve({
        date: VIEWED_DATE,
        slots: released
          ? [freeQuadra1(), freeQuadra2()]
          : [heldQuadra1(), freeQuadra2()],
      }),
    )
    listMine.mockImplementation(() =>
      Promise.resolve([
        makeReservation(released ? "Canceled" : "Confirmed", SLOT_08_ISO),
      ]),
    )
    cancelMine.mockResolvedValue(makeReservation("Canceled", SLOT_08_ISO))
    const user = userEvent.setup()
    renderAgenda()

    expect(
      await screen.findByRole("button", {
        name: `Quadra 1. ${i18n.t("tenantPortal.agenda.slotTaken")}`,
      }),
    ).toBeInTheDocument()
    const dayCalls = fetchDay.mock.calls.length

    try {
      await i18n.changeLanguage("en")
      expect(
        await screen.findByRole("button", {
          name: `Quadra 1. ${i18n.t("tenantPortal.agenda.slotTaken")}`,
        }),
      ).toBeInTheDocument()
      expect(fetchDay.mock.calls.length).toBe(dayCalls)

      released = true
      await confirmCancel(user)
      await expectQuadra1Selectable()
    } finally {
      await i18n.changeLanguage("pt-BR")
    }
  })

  it("keeps the selected date, time, and resource when the language changes", async () => {
    const user = userEvent.setup()
    renderAgenda()

    const dateInput = await screen.findByLabelText(
      i18n.t("tenantPortal.agenda.date"),
    )
    fireEvent.change(dateInput, { target: { value: "2026-10-20" } })
    await waitFor(() => {
      expect(fetchDay).toHaveBeenCalledWith("ficc", "2026-10-20")
    })

    await user.click(await screen.findByRole("button", { name: "Quadra 1" }))
    expect(
      screen.getByRole("button", { name: "Quadra 1" }),
    ).toHaveAttribute("aria-pressed", "true")
    expect(
      screen.getByRole("combobox", { name: i18n.t("tenantPortal.agenda.time") }),
    ).toHaveTextContent("08:00")

    const dayCalls = fetchDay.mock.calls.length
    const assetCalls = fetchAssets.mock.calls.length

    try {
      await i18n.changeLanguage("es")
      expect(
        screen.getByLabelText(i18n.t("tenantPortal.agenda.date")),
      ).toHaveValue("2026-10-20")
      expect(
        screen.getByRole("combobox", {
          name: i18n.t("tenantPortal.agenda.time"),
        }),
      ).toHaveTextContent("08:00")
      expect(
        screen.getByRole("button", { name: "Quadra 1" }),
      ).toHaveAttribute("aria-pressed", "true")
      expect(formatMoney(80)).toBe("80,00 R$")
      expect(
        screen.getByText(
          i18n.t("tenantPortal.agenda.available", {
            amount: formatMoney(80),
          }),
        ),
      ).toBeInTheDocument()

      await i18n.changeLanguage("en")
      expect(
        screen.getByLabelText(i18n.t("tenantPortal.agenda.date")),
      ).toHaveValue("2026-10-20")
      expect(
        screen.getByRole("button", { name: "Quadra 1" }),
      ).toHaveAttribute("aria-pressed", "true")
      expect(formatMoney(80)).toBe("R$ 80.00")
      expect(
        screen.getByText(
          i18n.t("tenantPortal.agenda.available", {
            amount: formatMoney(80),
          }),
        ),
      ).toBeInTheDocument()
      expect(fetchDay).toHaveBeenCalledTimes(dayCalls)
      expect(fetchAssets).toHaveBeenCalledTimes(assetCalls)
    } finally {
      await i18n.changeLanguage("pt-BR")
    }
  })

  it("refetches the cancelled reservation date and the viewed date", async () => {
    const user = userEvent.setup()
    const otherIso = "2026-10-15T11:00:00.000Z"
    fetchDay.mockImplementation((_subdomain: string, dayDate: string) =>
      Promise.resolve({
        date: dayDate,
        slots: [freeQuadra1(), freeQuadra2()],
      }),
    )
    let released = false
    listMine.mockImplementation(() =>
      Promise.resolve([
        makeReservation(released ? "Canceled" : "Confirmed", otherIso),
      ]),
    )
    cancelMine.mockResolvedValue(makeReservation("Canceled", otherIso))
    renderAgenda()

    await expectQuadra1Selectable()
    released = true
    await confirmCancel(user)

    await waitFor(() => {
      const dates = fetchDay.mock.calls.map((call) => call[1])
      expect(dates).toContain(VIEWED_DATE)
      expect(dates).toContain(OTHER_DATE)
    })

    fireEvent.change(screen.getByLabelText(i18n.t("tenantPortal.agenda.date")), {
      target: { value: OTHER_DATE },
    })
    await expectQuadra1Selectable()
  })

  it("does not paint another date when that day's refresh returns a taken slot", async () => {
    const user = userEvent.setup()
    const otherIso = "2026-10-15T11:00:00.000Z"
    fetchDay.mockImplementation((_subdomain: string, dayDate: string) =>
      Promise.resolve({
        date: dayDate,
        slots:
          dayDate === OTHER_DATE
            ? [
                agendaSlot(ASSET_A_ID, "Quadra 1", {
                  status: "booked",
                  isBookableByCustomer: false,
                  reservationId: null,
                }),
              ]
            : [freeQuadra1(), freeQuadra2()],
      }),
    )
    let released = false
    listMine.mockImplementation(() =>
      Promise.resolve([
        makeReservation(released ? "Canceled" : "Confirmed", otherIso),
      ]),
    )
    cancelMine.mockResolvedValue(makeReservation("Canceled", otherIso))
    renderAgenda()

    await expectQuadra1Selectable()
    released = true
    await confirmCancel(user)

    await waitFor(() => {
      expect(fetchDay.mock.calls.map((call) => call[1])).toContain(OTHER_DATE)
    })
    await expectQuadra1Selectable()
  })

  it("keeps a taken mark on its own date when the customer changes day", async () => {
    const user = userEvent.setup()
    let calls = 0
    fetchDay.mockImplementation((_subdomain: string, dayDate: string) => {
      calls += 1
      if (calls === 2) {
        return new Promise(() => {})
      }
      return Promise.resolve({
        date: dayDate,
        slots: [freeQuadra1(), freeQuadra2()],
      })
    })
    bookSlot.mockRejectedValue(
      new PortalBookingError(
        "O local 'Sala 1' não está disponível para o intervalo solicitado.",
        409,
        null,
      ),
    )
    renderAgenda()

    await bookQuadra1(user)
    expect(
      await screen.findByRole("button", {
        name: `Quadra 1. ${i18n.t("tenantPortal.agenda.slotTaken")}`,
      }),
    ).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(i18n.t("tenantPortal.agenda.date")), {
      target: { value: OTHER_DATE },
    })

    await expectQuadra1Selectable()
  })

  it("discards a schedule response for a date the customer already left", async () => {
    let resolveOther: (value: {
      date: string
      slots: PortalScheduleSlot[]
    }) => void = () => {}
    const requested: string[] = []
    fetchDay.mockImplementation((_subdomain: string, dayDate: string) => {
      requested.push(dayDate)
      if (requested.length === 1) {
        return Promise.resolve({
          date: dayDate,
          slots: [freeQuadra1(), freeQuadra2()],
        })
      }
      if (dayDate === OTHER_DATE) {
        return new Promise((resolve) => {
          resolveOther = resolve
        })
      }
      return Promise.resolve({
        date: dayDate,
        slots: [freeQuadra1(), freeQuadra2()],
      })
    })
    renderAgenda()
    await expectQuadra1Selectable()

    fireEvent.change(screen.getByLabelText(i18n.t("tenantPortal.agenda.date")), {
      target: { value: OTHER_DATE },
    })
    await waitFor(() => {
      expect(requested).toContain(OTHER_DATE)
    })
    fireEvent.change(screen.getByLabelText(i18n.t("tenantPortal.agenda.date")), {
      target: { value: VIEWED_DATE },
    })
    await expectQuadra1Selectable()

    await act(async () => {
      resolveOther({
        date: OTHER_DATE,
        slots: [
          agendaSlot(ASSET_A_ID, "Quadra 1", {
            status: "booked",
            isBookableByCustomer: false,
            reservationId: null,
          }),
        ],
      })
      await Promise.resolve()
    })

    await expectQuadra1Selectable()
  })

  it("retries a failed slot refresh once and then toasts", async () => {
    const user = userEvent.setup()
    let calls = 0
    fetchDay.mockImplementation(() => {
      calls += 1
      if (calls === 1) {
        return Promise.resolve({
          date: VIEWED_DATE,
          slots: [heldQuadra1(), freeQuadra2()],
        })
      }
      return Promise.reject(new Error("schedule down"))
    })
    let released = false
    listMine.mockImplementation(() =>
      Promise.resolve([
        makeReservation(released ? "Canceled" : "Confirmed", SLOT_08_ISO),
      ]),
    )
    cancelMine.mockResolvedValue(makeReservation("Canceled", SLOT_08_ISO))
    renderAgenda()

    expect(
      await screen.findByRole("button", {
        name: `Quadra 1. ${i18n.t("tenantPortal.agenda.slotTaken")}`,
      }),
    ).toBeInTheDocument()

    released = true
    await confirmCancel(user)

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith("schedule down")
    })
    expect(toastError).toHaveBeenCalledTimes(1)
    expect(calls).toBe(3)
    expect(
      screen.getByRole("button", {
        name: `Quadra 1. ${i18n.t("tenantPortal.agenda.slotTaken")}`,
      }),
    ).toBeInTheDocument()
  })

  it("recovers the slot when the first refresh fails and the retry succeeds", async () => {
    const user = userEvent.setup()
    let calls = 0
    fetchDay.mockImplementation(() => {
      calls += 1
      if (calls === 1) {
        return Promise.resolve({
          date: VIEWED_DATE,
          slots: [heldQuadra1(), freeQuadra2()],
        })
      }
      if (calls === 2) {
        return Promise.reject(new Error("schedule down"))
      }
      return Promise.resolve({
        date: VIEWED_DATE,
        slots: [freeQuadra1(), freeQuadra2()],
      })
    })
    let released = false
    listMine.mockImplementation(() =>
      Promise.resolve([
        makeReservation(released ? "Canceled" : "Confirmed", SLOT_08_ISO),
      ]),
    )
    cancelMine.mockResolvedValue(makeReservation("Canceled", SLOT_08_ISO))
    renderAgenda()

    expect(
      await screen.findByRole("button", {
        name: `Quadra 1. ${i18n.t("tenantPortal.agenda.slotTaken")}`,
      }),
    ).toBeInTheDocument()

    released = true
    await confirmCancel(user)
    await expectQuadra1Selectable()
    expect(toastError).not.toHaveBeenCalled()
    expect(calls).toBe(3)
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
    toastMessage.mockReset()
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
    toastMessage.mockReset()
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

    await waitFor(() => {
      expect(buttonNamed(i18n.t("tenantPortal.agenda.reserveSlot"))).toBeEnabled()
    })
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
    await waitFor(() => {
      expect(buttonNamed(i18n.t("tenantPortal.agenda.reserveSlot"))).toBeEnabled()
    })
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
