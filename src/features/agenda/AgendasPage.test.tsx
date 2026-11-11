import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, useLocation } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { TenantTimeZoneContext } from "@/contexts/TenantTimeZoneContext"
import { usePermissions } from "@/features/users/permissions/PermissionContext"
import { listRentalAssetCategories } from "@/features/rentals/services/rentalResourcesService"
import { listCatalogOrders, listCatalogProducts } from "@/features/catalog/services/catalogService"
import { catalogOrderSchema, catalogProductSchema } from "@/features/catalog/schemas/catalogSchemas"
import { AgendaFilters } from "./AgendaFilters"
import { parseAgendaState } from "./urlState"
import { AgendasPage, type AgendasView } from "./AgendasPage"

vi.mock("@/features/users/permissions/PermissionContext", () => ({ usePermissions: vi.fn() }))
vi.mock("@/features/rentals/services/rentalResourcesService", () => ({ listRentalAssetCategories: vi.fn() }))
vi.mock("@/features/catalog/services/catalogService", () => ({
  listCatalogProducts: vi.fn(),
  listCatalogOrders: vi.fn(),
  listCatalogResourceAgenda: vi.fn().mockResolvedValue({ resources: [], items: [] }),
}))
vi.mock("@/features/rentals/services/scheduleService", () => ({
  listAdminRentalAssets: vi.fn().mockResolvedValue([]),
  fetchAdminScheduleDay: vi.fn().mockResolvedValue({ date: "2026-11-10", slots: [] }),
  listOccupancyKinds: vi.fn().mockResolvedValue([]),
}))
vi.mock("@/features/rentals/services/reservationsService", () => ({
  listAdminReservations: vi.fn().mockResolvedValue([]),
}))
const categoryId = "11111111-1111-4111-8111-111111111111"
const productId = "22222222-2222-4222-8222-222222222222"
const orderId = "33333333-3333-4333-8333-333333333333"
function access(modules = ["rentals", "catalog"], grants = ["rentals.assets.read", "catalog.products.read", "catalog.orders.read"]) {
  vi.mocked(usePermissions).mockReturnValue({ activeModules: modules, permissions: grants, can: (key) => grants.includes(key), isLoading: false, currentUser: null, error: null, refresh: vi.fn() })
}
function Location() { return <output data-testid="search">{useLocation().search}</output> }
function setup(search = "?visao=dia&date=2026-11-10", view: AgendasView = "overview") {
  return render(<TenantTimeZoneContext.Provider value="America/Sao_Paulo"><MemoryRouter initialEntries={[`/agendas${search}`]}><AgendasPage view={view} /><Location /></MemoryRouter></TenantTimeZoneContext.Provider>)
}
function params() { return new URLSearchParams(screen.getByTestId("search").textContent ?? "") }
const tipoOrder = ["Todos", "Reserva", "Pedido", "Manutenção", "Bloqueio"]
function tipoButtonNames() {
  return within(screen.getByRole("group", { name: "Tipo" })).getAllByRole("button").map((button) => button.textContent?.trim())
}

beforeEach(() => {
  vi.clearAllMocks()
  access()
  vi.mocked(listRentalAssetCategories).mockResolvedValue([{ id: categoryId, name: "Estúdio" }])
  vi.mocked(listCatalogProducts).mockResolvedValue([catalogProductSchema.parse({ id: productId, name: "Podcast", code: null, description: null, price: null, currency: "BRL", isActive: true, createdAt: "2026-11-10T12:00:00Z", files: [] })])
  vi.mocked(listCatalogOrders).mockResolvedValue([catalogOrderSchema.parse({ id: orderId, displayNumber: "#42", orderNumber: 42, status: "Requested", customerId: categoryId, customerName: "Ana", customerEmail: null, customerPhone: null, customerNote: null, totalAmount: null, currency: "BRL", rejectedReason: null, cancelledReason: null, createdAt: "2026-11-10T12:00:00Z", items: [], history: [] })])
})

describe("new staff agendas", () => {
  it.each([
    ["overview", "Visão geral das agendas"], ["resources", "Agenda de recursos"], ["product", "Agenda do produto"],
  ] as const)("renders one title and puts view controls in the date navigation for %s", (view, title) => {
    setup(undefined, view)
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1)
    expect(screen.getByRole("heading", { level: 1, name: title })).toBeInTheDocument()
    expect(screen.getAllByText(title)).toHaveLength(1)
    expect(screen.queryByRole("button", { name: "Nova reserva" })).not.toBeInTheDocument()
    expect(screen.getByText("Operação · Agendas")).toBeInTheDocument()
    const dateNav = screen.getByRole("group", { name: "Navegação por data" })
    expect(within(dateNav).getByRole("button", { name: "Dia" })).toBeInTheDocument()
    expect(within(dateNav).getByRole("button", { name: "Semana" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { level: 1 }).parentElement).not.toContainElement(dateNav)
  })

  it("keeps Todos first and preserves period when clearing filters", async () => {
    setup("?visao=semana&date=2026-11-10&recurso=" + categoryId + "&tipo=pedido")
    expect(tipoButtonNames()).toEqual(tipoOrder)
    await userEvent.click(screen.getByRole("button", { name: "Limpar" }))
    expect(params().get("visao")).toBe("semana")
    expect(params().get("date")).toBe("2026-11-10")
    expect(params().has("tipo")).toBe(false)
    expect(params().has("recurso")).toBe(false)
    expect(within(screen.getByRole("group", { name: "Tipo" })).getAllByRole("button")[0]).toHaveAttribute("aria-pressed", "true")
  })

  it("requires a product and never offers Todos in its picker", async () => {
    setup(undefined, "product")
    expect(screen.getByText("Escolha um produto para consultar sua agenda.")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Produto" }))
    const picker = screen.getByRole("listbox", { name: "Produto" })
    expect(within(picker).queryByRole("option", { name: "Todos" })).not.toBeInTheDocument()
    await userEvent.click(await within(picker).findByRole("option", { name: "Podcast" }))
    expect(params().get("produto")).toBe(productId)
    expect(screen.queryByText("Escolha um produto para consultar sua agenda.")).not.toBeInTheDocument()
  })

  it("keeps search visible on phone while filters expand inside the page", async () => {
    vi.stubGlobal("matchMedia", vi.fn((query: string) => ({ matches: query.includes("639"), addEventListener: vi.fn(), removeEventListener: vi.fn() })))
    try {
      setup()
      expect(screen.getByRole("combobox", { name: "Buscar pedido por número ou cliente" })).toBeInTheDocument()
      expect(screen.queryByRole("group", { name: "Tipo" })).not.toBeInTheDocument()
      await userEvent.click(screen.getByRole("button", { name: /Filtros.*\+/ }))
      expect(screen.getByRole("group", { name: "Tipo" })).toBeInTheDocument()
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    } finally { vi.unstubAllGlobals() }
  })
})


it("uses the fallback product name in mobile chips for an orders-only reader", () => {
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })))
  try {
    const state = parseAgendaState(new URLSearchParams("produto=" + productId), "2026-11-10")
    render(<AgendaFilters state={state} rental={false} product={false} order modern requiredProduct
      availableProducts={[{ id: productId, label: "Podcast" }]} onChange={() => {}} />)
    expect(screen.getByRole("button", { name: "Remover Podcast" })).toBeInTheDocument()
    expect(screen.queryByText(productId)).not.toBeInTheDocument()
  } finally { vi.unstubAllGlobals() }
})
