import { render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { TodayAgendaCard } from "./TodayAgendaCard"
import { TestPermissionProvider } from "@/features/users/permissions/PermissionContext"
import {
  listCatalogProductAgenda,
  listCatalogResourceAgenda,
} from "@/features/catalog/services/catalogService"
import type { CatalogAgendaItem } from "@/features/catalog/schemas/catalogSchemas"

vi.mock("@/features/catalog/services/catalogService", () => ({
  listCatalogResourceAgenda: vi.fn(),
  listCatalogProductAgenda: vi.fn(),
}))

function item(overrides: Partial<CatalogAgendaItem>): CatalogAgendaItem {
  return {
    orderId: "o1",
    displayNumber: "ORD-1",
    orderStatus: "Approved",
    productId: "p1",
    productName: "Buffet",
    rentalAssetId: null,
    resourceName: null,
    customerName: "Acme",
    workStart: null,
    workEnd: "2999-01-01T12:00:00.000Z",
    occupiedStart: null,
    occupiedEnd: null,
    allocationStatus: null,
    timeZoneId: "UTC",
    ...overrides,
  }
}

function renderCard(permissions: string[], activeModules: string[] = ["catalog", "rentals"]) {
  return render(
    <MemoryRouter>
      <TestPermissionProvider permissions={permissions} activeModules={activeModules}>
        <TodayAgendaCard />
      </TestPermissionProvider>
    </MemoryRouter>,
  )
}

describe("TodayAgendaCard", () => {
  beforeEach(() => {
    vi.mocked(listCatalogResourceAgenda).mockReset()
    vi.mocked(listCatalogProductAgenda).mockReset()
  })

  it("renders nothing and fetches nothing without either permission", () => {
    const { container } = render(
      <MemoryRouter>
        <TestPermissionProvider permissions={["os.work_orders.read"]}>
          <TodayAgendaCard />
        </TestPermissionProvider>
      </MemoryRouter>,
    )
    expect(container).toBeEmptyDOMElement()
    expect(listCatalogResourceAgenda).not.toHaveBeenCalled()
    expect(listCatalogProductAgenda).not.toHaveBeenCalled()
  })

  it("renders nothing and fetches nothing when the catalog module is inactive", () => {
    const { container } = renderCard(["rentals.schedule.read", "catalog.orders.read"], ["rentals"])
    expect(container).toBeEmptyDOMElement()
    expect(listCatalogResourceAgenda).not.toHaveBeenCalled()
    expect(listCatalogProductAgenda).not.toHaveBeenCalled()
  })

  it("falls back to product mode when the rentals module is inactive", async () => {
    vi.mocked(listCatalogProductAgenda).mockResolvedValue([
      item({ orderId: "o8", productId: "p8", productName: "Bolo", allocationStatus: "Scheduled", workStart: "2999-01-01T09:00:00.000Z" }),
    ])
    renderCard(["rentals.schedule.read", "catalog.orders.read"], ["catalog"])
    expect(await screen.findByText("Bolo")).toBeInTheDocument()
    expect(listCatalogResourceAgenda).not.toHaveBeenCalled()
  })

  it("refetches when the tenant changes (no stale rows from the previous tenant)", async () => {
    vi.mocked(listCatalogResourceAgenda)
      .mockResolvedValueOnce({ resources: [{ id: "r1", name: "Tenant A room", category: null }], items: [] })
      .mockResolvedValueOnce({ resources: [{ id: "r2", name: "Tenant B room", category: null }], items: [] })
    const user = (tenantId: string) => ({
      id: null, fullName: "T", email: "t@example.com", role: "USER" as const, tenantId,
      activeModules: ["catalog", "rentals"], activeAssetFamilies: [], isTrial: false, isTrialReadOnly: false,
      notificationsEmailOnly: false, roles: [], permissions: ["rentals.schedule.read"],
    })
    const tree = (tenantId: string) => (
      <MemoryRouter>
        <TestPermissionProvider currentUser={user(tenantId)}>
          <TodayAgendaCard />
        </TestPermissionProvider>
      </MemoryRouter>
    )
    const { rerender } = render(tree("11111111-1111-4111-8111-111111111111"))
    expect(await screen.findByText("Tenant A room")).toBeInTheDocument()
    rerender(tree("22222222-2222-4222-8222-222222222222"))
    expect(await screen.findByText("Tenant B room")).toBeInTheDocument()
    expect(screen.queryByText("Tenant A room")).not.toBeInTheDocument()
    expect(listCatalogResourceAgenda).toHaveBeenCalledTimes(2)
  })

  it("lists resources including idle ones, an in-use row, and redacts missing numbers", async () => {
    vi.mocked(listCatalogResourceAgenda).mockResolvedValue({
      resources: [
        { id: "r1", name: "Palco A", category: null },
        { id: "r2", name: "Som B", category: null },
      ],
      items: [item({ orderId: "o1", rentalAssetId: "r1", displayNumber: null, allocationStatus: "Running" })],
    })
    renderCard(["rentals.schedule.read"])

    expect(await screen.findByText("Palco A")).toBeInTheDocument()
    expect(screen.getByText("Em uso")).toBeInTheDocument()
    expect(screen.getByText("Livre")).toBeInTheDocument()
    expect(screen.getByText(/Reservado/)).toBeInTheDocument()
    expect(listCatalogProductAgenda).not.toHaveBeenCalled()
  })

  it("falls back to the product agenda when only orders.read is granted", async () => {
    vi.mocked(listCatalogProductAgenda).mockResolvedValue([
      item({ orderId: "o9", productId: "p9", productName: "Coffee break", allocationStatus: "Scheduled", workStart: "2999-01-01T09:00:00.000Z" }),
    ])
    renderCard(["catalog.orders.read"])

    expect(await screen.findByText("Coffee break")).toBeInTheDocument()
    await waitFor(() => expect(listCatalogProductAgenda).toHaveBeenCalled())
    expect(listCatalogResourceAgenda).not.toHaveBeenCalled()
  })
  it("labels the card with today's tenant date and shows the order number without a double #", async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-11-03T15:00:00Z") })
    try {
      vi.mocked(listCatalogResourceAgenda).mockResolvedValue({
        resources: [{ id: "r1", name: "Palco A", category: null }],
        items: [item({ rentalAssetId: "r1", displayNumber: "#22", allocationStatus: "Running" })],
      })
      renderCard(["rentals.schedule.read"])
      expect(await screen.findByText("Palco A")).toBeInTheDocument()
      expect(screen.getByText(/03 de nov/)).toBeInTheDocument()
      expect(screen.queryByText(/01 de nov/)).not.toBeInTheDocument()
      expect(screen.queryByText(/##22/)).not.toBeInTheDocument()
      expect(screen.getByText(/#22/)).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it("links each row to the agenda filtered to that resource", async () => {
    vi.mocked(listCatalogResourceAgenda).mockResolvedValue({
      resources: [{ id: "r1", name: "Palco A", category: null }, { id: "r2", name: "Som B", category: null }],
      items: [],
    })
    renderCard(["rentals.schedule.read"])
    expect((await screen.findByText("Palco A")).closest("a")).toHaveAttribute("href", "/agendas/recursos?recursos=r1")
    expect(screen.getByText("Som B").closest("a")).toHaveAttribute("href", "/agendas/recursos?recursos=r2")
  })

  it("links product rows to the agenda filtered to that product", async () => {
    vi.mocked(listCatalogProductAgenda).mockResolvedValue([
      item({ orderId: "o9", productId: "p9", productName: "Coffee break", allocationStatus: "Scheduled", workStart: "2999-01-01T09:00:00.000Z" }),
    ])
    renderCard(["catalog.orders.read"])
    expect((await screen.findByText("Coffee break")).closest("a")).toHaveAttribute("href", "/agendas/produto?produto=p9")
  })

  it("shows a human delay and links an overdue row to its order", async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-11-03T15:00:00Z") })
    try {
      vi.mocked(listCatalogResourceAgenda).mockResolvedValue({
        resources: [{ id: "r1", name: "Palco A", category: null }],
        items: [item({ orderId: "ord-30", rentalAssetId: "r1", displayNumber: "#30", allocationStatus: "Scheduled", workStart: "2026-11-01T15:00:00Z", workEnd: "2026-11-01T17:00:00Z" })],
      })
      renderCard(["rentals.schedule.read", "catalog.orders.read"])
      const sub = await screen.findByText("Início do Pedido #30 · atrasado há 2 dias")
      expect(sub.closest("a")).toHaveAttribute("href", "/pedidos/ord-30")
    } finally {
      vi.useRealTimers()
    }
  })

  it("keeps the resource link for an overdue row when orders cannot be read", async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-11-03T15:00:00Z") })
    try {
      vi.mocked(listCatalogResourceAgenda).mockResolvedValue({
        resources: [{ id: "r1", name: "Palco A", category: null }],
        items: [item({ orderId: "ord-30", rentalAssetId: "r1", displayNumber: "#30", allocationStatus: "Scheduled", workStart: "2026-11-03T14:20:00Z", workEnd: "2026-11-03T14:50:00Z" })],
      })
      renderCard(["rentals.schedule.read"])
      const sub = await screen.findByText("Início do Pedido #30 · atrasado há 40 min")
      expect(sub.closest("a")).toHaveAttribute("href", "/agendas/recursos?recursos=r1")
    } finally {
      vi.useRealTimers()
    }
  })
})
