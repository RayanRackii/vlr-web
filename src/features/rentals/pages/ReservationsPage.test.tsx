import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { MemoryRouter } from "react-router-dom"

import { TestPermissionProvider } from "@/features/users/permissions/PermissionContext"
import i18n from "@/lib/i18n"

vi.mock("@/features/users/hooks/useTrialStatus", () => ({
  useTrialStatus: () => ({
    isLoading: false,
    isTrial: false,
    isTrialReadOnly: false,
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

vi.mock("@/features/rentals/services/reservationsService", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/features/rentals/services/reservationsService")>()
  return {
    ...actual,
    listAdminReservations: vi.fn(),
    confirmAdminReservation: vi.fn(),
    cancelAdminReservation: vi.fn(),
    completeAdminReservation: vi.fn(),
  }
})

import { toast } from "sonner"
import { ReservationsPage } from "@/features/rentals/pages/ReservationsPage"
import {
  cancelAdminReservation,
  completeAdminReservation,
  confirmAdminReservation,
  listAdminReservations,
  type AdminReservation,
  type ReservationStatus,
} from "@/features/rentals/services/reservationsService"

const COMPLETE_PERM = "rentals.reservations.complete"
const RESERVATION_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"

const listMock = vi.mocked(listAdminReservations)
const confirmMock = vi.mocked(confirmAdminReservation)
const cancelMock = vi.mocked(cancelAdminReservation)
const completeMock = vi.mocked(completeAdminReservation)
const toastSuccess = vi.mocked(toast.success)

function makeReservation(
  status: ReservationStatus,
  overrides: Partial<AdminReservation> = {},
): AdminReservation {
  return {
    id: RESERVATION_ID,
    tenantId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    unitId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    customerId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    customerName: "Ana Souza",
    customerWhatsApp: "+5511999999999",
    startDateTime: "2026-09-06T13:00:00.000Z",
    endDateTime: "2026-09-06T14:00:00.000Z",
    status,
    totalAmount: 80,
    depositPaid: 80,
    createdAt: "2026-09-05T12:00:00.000Z",
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

function renderPage(permissions: readonly string[] = [COMPLETE_PERM]) {
  return render(
    <MemoryRouter>
      <TestPermissionProvider permissions={permissions} activeModules={["rentals"]}>
        <ReservationsPage />
      </TestPermissionProvider>
    </MemoryRouter>,
  )
}

function completeButton() {
  return screen.queryByRole("button", {
    name: i18n.t("rentals.reservations.complete"),
  })
}

describe("ReservationsPage Complete", () => {
  beforeEach(() => {
    listMock.mockReset()
    confirmMock.mockReset()
    cancelMock.mockReset()
    completeMock.mockReset()
    toastSuccess.mockReset()
    listMock.mockResolvedValue([])
  })

  it("shows Concluir when the reservation is Confirmed and the user can complete", async () => {
    listMock.mockResolvedValue([makeReservation("Confirmed")])
    renderPage([COMPLETE_PERM])

    expect(await screen.findByText("Ana Souza")).toBeInTheDocument()
    expect(completeButton()).toBeInTheDocument()
    expect(screen.getByText(/10:00/)).toBeInTheDocument()
    expect(screen.getByText(/11:00/)).toBeInTheDocument()
  })

  it("hides Concluir when the reservation is Confirmed but the permission is missing", async () => {
    listMock.mockResolvedValue([makeReservation("Confirmed")])
    renderPage(["rentals.reservations.read", "rentals.reservations.confirm"])

    expect(await screen.findByText("Ana Souza")).toBeInTheDocument()
    expect(completeButton()).not.toBeInTheDocument()
  })

  it.each(["PendingDeposit", "Completed", "Canceled"] as const)(
    "hides Concluir when status is %s even with complete permission",
    async (status) => {
      listMock.mockResolvedValue([makeReservation(status)])
      renderPage([COMPLETE_PERM])

      expect(await screen.findByText("Ana Souza")).toBeInTheDocument()
      expect(completeButton()).not.toBeInTheDocument()
    },
  )

  it("completes a Confirmed reservation, toasts success, and reloads without Concluir", async () => {
    const user = userEvent.setup()
    const confirmed = makeReservation("Confirmed")
    const completed = makeReservation("Completed")
    let rows: AdminReservation[] = [confirmed]

    listMock.mockImplementation(async () => rows)
    completeMock.mockImplementation(async () => {
      rows = [completed]
      return completed
    })

    renderPage([COMPLETE_PERM])
    expect(await screen.findByText("Ana Souza")).toBeInTheDocument()
    expect(completeButton()).toBeInTheDocument()

    await user.click(
      screen.getByRole("button", {
        name: i18n.t("rentals.reservations.complete"),
      }),
    )

    await waitFor(() => {
      expect(completeMock).toHaveBeenCalledWith(RESERVATION_ID)
    })
    expect(toastSuccess).toHaveBeenCalledWith(
      i18n.t("rentals.reservations.completeSuccess"),
    )

    await waitFor(() => {
      expect(listMock.mock.calls.length).toBeGreaterThanOrEqual(2)
    })
    expect(await screen.findByText("Ana Souza")).toBeInTheDocument()
    expect(completeButton()).not.toBeInTheDocument()
  })
})
