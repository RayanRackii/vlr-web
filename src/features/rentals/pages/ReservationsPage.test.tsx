import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { MemoryRouter } from "react-router-dom"

import { TestPermissionProvider } from "@/features/users/permissions/PermissionContext"
import i18n from "@/lib/i18n"

const trialState = vi.hoisted(() => ({ readOnly: false }))

vi.mock("@/features/users/hooks/useTrialStatus", () => ({
  useTrialStatus: () => ({
    isLoading: false,
    isTrial: false,
    isTrialReadOnly: trialState.readOnly,
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
import { ReservationsScreen } from "@/features/rentals/pages/ReservationsScreen"
import {
  cancelAdminReservation,
  completeAdminReservation,
  confirmAdminReservation,
  formatMoney,
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

beforeEach(() => { trialState.readOnly = false })

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

describe("ReservationsPage", () => {
  beforeEach(() => {
    listMock.mockReset()
    confirmMock.mockReset()
    cancelMock.mockReset()
    completeMock.mockReset()
    toastSuccess.mockReset()
    listMock.mockResolvedValue([])
  })

  it("lists only returned reservations in time order with a count, duration and resource quantities", async () => {
    listMock.mockResolvedValue([
      makeReservation("Canceled", { id: "late", customerName: "Bruno Lima", startDateTime: "2026-09-06T16:00:00Z", endDateTime: "2026-09-06T17:30:00Z" }),
      makeReservation("Confirmed"),
    ])
    renderPage()

    const table = await screen.findByRole("table", { name: "Reservas" })
    const rows = within(table).getAllByRole("row")
    expect(rows).toHaveLength(3)
    expect(rows[1]).toHaveTextContent("Ana Souza")
    expect(rows[2]).toHaveTextContent("Bruno Lima")
    expect(rows[2]).toHaveTextContent("1h30min")
    expect(within(rows[2]).queryByRole("button")).not.toBeInTheDocument()
    expect(screen.getByText("2 reservas")).toBeInTheDocument()
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument()
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

describe("ReservationsPage Cancel confirmation", () => {
  beforeEach(() => {
    listMock.mockReset()
    confirmMock.mockReset()
    cancelMock.mockReset()
    completeMock.mockReset()
    toastSuccess.mockReset()
    listMock.mockResolvedValue([])
  })

  it("asks for confirmation before cancelling and shows the customer, resource and time range", async () => {
    const user = userEvent.setup()
    listMock.mockResolvedValue([makeReservation("Confirmed")])
    renderPage([COMPLETE_PERM])

    expect(await screen.findByText("Ana Souza")).toBeInTheDocument()
    await user.click(
      screen.getByRole("button", { name: i18n.t("rentals.reservations.cancel") }),
    )

    expect(cancelMock).not.toHaveBeenCalled()
    const dialog = await screen.findByRole("alertdialog")
    expect(
      screen.getByText(i18n.t("rentals.reservations.cancelConfirmTitle")),
    ).toBeInTheDocument()
    expect(screen.getAllByText("Ana Souza").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Quadra 1").length).toBeGreaterThan(0)
    expect(within(dialog).getByText(/10:00/)).toBeInTheDocument()
    expect(within(dialog).getByText(/11:00/)).toBeInTheDocument()
    expect(dialog).toBeInTheDocument()
  })

  it("cancels the reservation only after the destructive action is confirmed", async () => {
    const user = userEvent.setup()
    const confirmed = makeReservation("Confirmed")
    const canceled = makeReservation("Canceled")
    let rows: AdminReservation[] = [confirmed]

    listMock.mockImplementation(async () => rows)
    cancelMock.mockImplementation(async () => {
      rows = [canceled]
      return canceled
    })

    renderPage([COMPLETE_PERM])
    expect(await screen.findByText("Ana Souza")).toBeInTheDocument()

    await user.click(
      screen.getByRole("button", { name: i18n.t("rentals.reservations.cancel") }),
    )
    await screen.findByRole("alertdialog")

    await user.click(
      screen.getByRole("button", {
        name: i18n.t("rentals.reservations.cancelConfirmAction"),
      }),
    )

    await waitFor(() => {
      expect(cancelMock).toHaveBeenCalledWith(RESERVATION_ID)
    })
    expect(toastSuccess).toHaveBeenCalledWith(
      i18n.t("rentals.reservations.cancelSuccess"),
    )
    await waitFor(() => {
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
    })
  })

  it("dismisses the dialog without cancelling when Manter reserva is clicked", async () => {
    const user = userEvent.setup()
    listMock.mockResolvedValue([makeReservation("Confirmed")])
    renderPage([COMPLETE_PERM])

    expect(await screen.findByText("Ana Souza")).toBeInTheDocument()
    await user.click(
      screen.getByRole("button", { name: i18n.t("rentals.reservations.cancel") }),
    )
    await screen.findByRole("alertdialog")

    await user.click(
      screen.getByRole("button", {
        name: i18n.t("rentals.reservations.cancelConfirmDismiss"),
      }),
    )

    await waitFor(() => {
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
    })
    expect(cancelMock).not.toHaveBeenCalled()
  })

  it("shows the item quantity and total amount in the cancel confirmation", async () => {
    const user = userEvent.setup()
    listMock.mockResolvedValue([
      makeReservation("Confirmed", {
        totalAmount: 240,
        items: [
          {
            id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
            assetId: "ffffffff-ffff-4fff-8fff-ffffffffffff",
            rentalAssetId: "11111111-1111-4111-8111-111111111111",
            assetName: "Quadra 1",
            quantity: 3,
            unitPrice: 80,
            subTotal: 240,
          },
        ],
      }),
    ])
    renderPage([COMPLETE_PERM])

    expect(await screen.findByText("Ana Souza")).toBeInTheDocument()
    await user.click(
      screen.getByRole("button", { name: i18n.t("rentals.reservations.cancel") }),
    )

    const dialog = await screen.findByRole("alertdialog")
    expect(within(dialog).getByText(/Quadra 1 ×3/)).toBeInTheDocument()
    expect(
      within(dialog).getByText(
        i18n.t("rentals.reservations.cancelConfirmTotal", {
          amount: formatMoney(240),
        }),
      ),
    ).toBeInTheDocument()
  })
})

describe("ReservationsPage filters and states", () => {
  beforeEach(() => {
    listMock.mockReset().mockResolvedValue([])
    confirmMock.mockReset()
    cancelMock.mockReset()
    completeMock.mockReset()
  })

  it("moves between civil days, keeps the existing week/month/status queries and returns to today", async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText("Nenhuma reserva neste filtro.")
    const date = screen.getByLabelText("Data")
    const today = (date as HTMLInputElement).value
    fireEvent.change(date, { target: { value: "2026-10-31" } })
    await waitFor(() => expect(listMock).toHaveBeenLastCalledWith({ from: "2026-10-31", to: "2026-10-31", status: "" }))
    await user.click(screen.getByRole("button", { name: "Próximo dia" }))
    await waitFor(() => expect(listMock).toHaveBeenLastCalledWith({ from: "2026-11-01", to: "2026-11-01", status: "" }))
    await user.click(screen.getByRole("button", { name: "Dia anterior" }))
    expect(date).toHaveValue("2026-10-31")
    await user.click(screen.getByRole("button", { name: "Semana" }))
    await waitFor(() => expect(listMock).toHaveBeenLastCalledWith({ from: "2026-10-26", to: "2026-11-01", status: "" }))
    await user.click(screen.getByRole("button", { name: "Mês" }))
    await waitFor(() => expect(listMock).toHaveBeenLastCalledWith({ from: "2026-10-01", to: "2026-10-31", status: "" }))
    await user.click(within(screen.getByRole("group", { name: "Status" })).getByRole("button", { name: "Confirmada" }))
    await waitFor(() => expect(listMock).toHaveBeenLastCalledWith({ from: "2026-10-01", to: "2026-10-31", status: "Confirmed" }))
    expect(screen.getByRole("button", { name: "Confirmada" })).toHaveAttribute("aria-pressed", "true")
    await user.click(screen.getByRole("button", { name: "Hoje" }))
    expect(date).toHaveValue(today)
    expect(screen.getByRole("button", { name: "Mês" })).toHaveAttribute("aria-pressed", "true")
  })

  it("confirms a pending deposit and refreshes the existing list", async () => {
    const user = userEvent.setup()
    listMock.mockResolvedValueOnce([makeReservation("PendingDeposit")]).mockResolvedValue([makeReservation("Confirmed")])
    confirmMock.mockResolvedValue(makeReservation("Confirmed"))
    renderPage()
    await user.click(await screen.findByRole("button", { name: "Confirmar" }))
    expect(confirmMock).toHaveBeenCalledWith(RESERVATION_ID)
    await waitFor(() => expect(screen.queryByRole("button", { name: "Confirmar" })).not.toBeInTheDocument())
    expect(completeButton()).toBeInTheDocument()
  })

  it.each(["PendingDeposit", "Confirmed"] as const)("disables every mutation in trial read-only for %s while keeping filters available", async (status) => {
    trialState.readOnly = true
    listMock.mockResolvedValue([makeReservation(status)])
    renderPage()
    const table = await screen.findByRole("table")
    expect(screen.getByText(i18n.t("trial.readOnlyHint"))).toBeInTheDocument()
    for (const action of within(table).getAllByRole("button")) expect(action).toBeDisabled()
    expect(screen.getByRole("button", { name: "Semana" })).toBeEnabled()
    expect(confirmMock).not.toHaveBeenCalled()
    expect(cancelMock).not.toHaveBeenCalled()
    expect(completeMock).not.toHaveBeenCalled()
  })

  it("announces loading, then shows an error instead of an empty result and recovers through the existing filters", async () => {
    let rejectLoad!: (error: Error) => void
    listMock.mockReturnValueOnce(new Promise((_, reject) => { rejectLoad = reject }))
    renderPage()
    expect(screen.getByRole("status", { name: "Carregando reservas…" })).toBeInTheDocument()
    expect(screen.queryByText("Nenhuma reserva neste filtro.")).not.toBeInTheDocument()
    rejectLoad(new Error("Network unavailable"))
    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível carregar as reservas.")
    expect(screen.queryByText("Nenhuma reserva neste filtro.")).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Semana" }))
    expect(await screen.findByText("Nenhuma reserva neste filtro.")).toBeInTheDocument()
    expect(screen.getByText("Troque o dia, o período ou o status para ver outras reservas.")).toBeInTheDocument()
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  it("keeps dates visible for week/month and preserves multiday ranges", async () => {
    listMock.mockResolvedValue([
      makeReservation("Completed"),
      makeReservation("Completed", { id: "multiday", customerName: "Bruno Lima", startDateTime: "2026-09-07T03:00:00Z", endDateTime: "2026-09-09T03:00:00Z" }),
    ])
    renderPage()
    await screen.findByRole("table")
    await userEvent.click(screen.getByRole("button", { name: "Semana" }))
    const table = await screen.findByRole("table")
    expect(within(table).getByText("06/09/2026")).toBeInTheDocument()
    expect(within(table).getByText(/07\/09.*08\/09.*2 dias/)).toBeInTheDocument()
    expect(within(table).queryByRole("button")).not.toBeInTheDocument()
  })

  it("keeps the visible reservation after an action succeeds but reloading fails", async () => {
    listMock.mockResolvedValueOnce([makeReservation("PendingDeposit")]).mockRejectedValue(new Error("Offline"))
    confirmMock.mockResolvedValue(makeReservation("Confirmed"))
    renderPage()
    await userEvent.click(await screen.findByRole("button", { name: "Confirmar" }))
    expect(await screen.findByRole("alert")).toBeInTheDocument()
    expect(screen.getByRole("table")).toHaveTextContent("Ana Souza")
    expect(screen.queryByText("Nenhuma reserva neste filtro.")).not.toBeInTheDocument()
  })

  it("renders one page heading and permission-filtered route tabs in the screen", async () => {
    render(
      <MemoryRouter initialEntries={["/configuracoes/reservas"]}>
        <TestPermissionProvider permissions={["rentals.reservations.read"]} activeModules={["rentals"]}>
          <ReservationsScreen />
        </TestPermissionProvider>
      </MemoryRouter>,
    )
    await screen.findByText("Nenhuma reserva neste filtro.")
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1)
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Reservas")
    expect(screen.getByRole("tablist", { name: "Reservas" })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: "Reservas" })).toHaveAttribute("aria-selected", "true")
    expect(screen.queryByRole("tab", { name: "Regras de reserva" })).not.toBeInTheDocument()
    expect(screen.getByLabelText("Data")).toBeInTheDocument()
    expect(screen.getAllByTestId("tenant-tz-label")).toHaveLength(1)
  })
})
