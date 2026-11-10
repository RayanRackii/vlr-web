import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { formatDayLabel } from "@/features/catalog/components/agenda/agendaLayout"
import { CatalogResourceAgendaPage } from "@/features/catalog/pages/CatalogResourceAgendaPage"
import type {
  CatalogAgendaItem,
  CatalogResourceAgendaResponse,
} from "@/features/catalog/schemas/catalogSchemas"
import { TestPermissionProvider } from "@/features/users/permissions/PermissionContext"
import i18n from "@/lib/i18n"

vi.mock("@/features/catalog/services/catalogService", () => ({
  listCatalogResourceAgenda: vi.fn(),
}))
import { listCatalogResourceAgenda } from "@/features/catalog/services/catalogService"

const agendaMock = vi.mocked(listCatalogResourceAgenda)

const STUDIO = "33333333-3333-3333-3333-333333333333"
const GEAR = "44444444-4444-4444-4444-444444444444"
const EMPTY = "55555555-5555-5555-5555-555555555555"

const ORDER_ITEM: CatalogAgendaItem = {
  orderId: "22222222-2222-2222-2222-222222222222",
  displayNumber: "PED-1042", orderStatus: "Approved",
  productId: "11111111-1111-1111-1111-111111111111", productName: "Sessão de gravação",
  rentalAssetId: STUDIO, resourceName: "Sala Estúdio A", customerName: "Estúdio Aurora",
  workStart: "2026-11-03T12:30:00Z", workEnd: "2026-11-03T14:30:00Z",
  occupiedStart: "2026-11-03T12:00:00Z", occupiedEnd: "2026-11-03T14:50:00Z",
  allocationStatus: "Scheduled", timeZoneId: "America/Sao_Paulo",
}

const REDACTED_ITEM: CatalogAgendaItem = {
  orderId: "66666666-6666-6666-6666-666666666666",
  displayNumber: null, orderStatus: "Approved",
  productId: "11111111-1111-1111-1111-111111111111", productName: "Locação externa",
  rentalAssetId: GEAR, resourceName: "Equipamento B", customerName: null,
  workStart: "2026-11-03T16:00:00Z", workEnd: "2026-11-03T17:00:00Z",
  occupiedStart: "2026-11-03T15:45:00Z", occupiedEnd: "2026-11-03T17:15:00Z",
  allocationStatus: "Scheduled", timeZoneId: "America/Sao_Paulo",
}

const RESPONSE: CatalogResourceAgendaResponse = {
  items: [ORDER_ITEM, REDACTED_ITEM],
  resources: [
    { id: STUDIO, name: "Sala Estúdio A", category: "Estúdios" },
    { id: GEAR, name: "Equipamento B", category: "Equipamentos" },
    { id: EMPTY, name: "Kit vazio", category: "Equipamentos" },
  ],
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/catalogo/agenda-recursos"]}>
      <TestPermissionProvider permissions={["rentals.schedule.read"]}>
        <Routes>
          <Route path="/catalogo/agenda-recursos" element={<CatalogResourceAgendaPage />} />
          <Route path="/catalogo/pedidos/:orderId" element={<p>Order detail destination</p>} />
        </Routes>
      </TestPermissionProvider>
    </MemoryRouter>,
  )
}

describe("catalog resource agenda page", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date("2026-11-03T12:00:00Z"))
    agendaMock.mockReset()
    agendaMock.mockResolvedValue(RESPONSE)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("renders every resource row, including empty ones, and redacts missing customer data", async () => {
    renderPage()
    expect((await screen.findAllByText("Sala Estúdio A")).length).toBeGreaterThan(0)
    expect(screen.getAllByText("Equipamento B").length).toBeGreaterThan(0)
    // Empty resource row still shown with no blocks.
    expect(screen.getAllByText("Kit vazio").length).toBeGreaterThan(0)
    // No displayNumber and no customerName -> redacted "Reservado" label (no PII).
    expect(screen.getAllByRole("button", { name: i18n.t("catalog.resourceAgenda.reserved") }).length).toBeGreaterThan(0)
  })

  it("opens the detail panel with the order link only when a displayNumber exists", async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole("button", { name: "PED-1042" }))
    const link = screen.getByRole("link", { name: i18n.t("catalog.resourceAgenda.panel.openOrder") })
    expect(link).toHaveAttribute("href", `/catalogo/pedidos/${ORDER_ITEM.orderId}`)

    // Redacted block: panel shows but the "open order" link is hidden.
    await user.click(screen.getAllByRole("button", { name: i18n.t("catalog.resourceAgenda.reserved") })[0])
    expect(
      screen.queryByRole("link", { name: i18n.t("catalog.resourceAgenda.panel.openOrder") }),
    ).not.toBeInTheDocument()
  })

  it("lists each resource's bookings in a stack the narrow layout can show without a wide grid", async () => {
    renderPage()
    const stack = await screen.findByTestId("resource-agenda-stack")
    expect(stack.querySelector(".resource-agenda")).toBeNull()
    expect(stack.textContent).toContain("PED-1042")
    expect(stack.textContent).toContain("Kit vazio")
    expect(stack.textContent).toContain(i18n.t("catalog.agenda.free"))
  })

  it("shows the day on each narrow booking when the view covers more than one day", async () => {
    const user = userEvent.setup()
    renderPage()
    const day = formatDayLabel("2026-11-03", i18n.language)
    const stack = await screen.findByTestId("resource-agenda-stack")
    expect(stack.textContent).toContain(day)
    expect(stack.textContent).toContain("PED-1042")
    await user.click(screen.getByRole("button", { name: i18n.t("catalog.agenda.day") }))
    expect(screen.getByTestId("resource-agenda-stack").textContent).not.toContain(day)
  })
})
