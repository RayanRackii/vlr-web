import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, useLocation } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { TenantTimeZoneContext } from "@/contexts/TenantTimeZoneContext"
import { usePermissions } from "@/features/users/permissions/PermissionContext"
import { listRentalAssetCategories } from "@/features/rentals/services/rentalResourcesService"
import { listCatalogOrders, listCatalogProducts } from "@/features/catalog/services/catalogService"
import { catalogOrderSchema, catalogProductSchema } from "@/features/catalog/schemas/catalogSchemas"
import { AgendaPage } from "./AgendaPage"

vi.mock("@/features/users/permissions/PermissionContext", () => ({ usePermissions: vi.fn() }))
vi.mock("@/features/rentals/services/rentalResourcesService", () => ({ listRentalAssetCategories: vi.fn() }))
vi.mock("@/features/catalog/services/catalogService", () => ({ listCatalogProducts: vi.fn(), listCatalogOrders: vi.fn() }))
const categoryId = "11111111-1111-4111-8111-111111111111"
const productId = "22222222-2222-4222-8222-222222222222"
const orderId = "33333333-3333-4333-8333-333333333333"
function access(modules = ["rentals", "catalog"], grants = ["rentals.assets.read", "catalog.products.read", "catalog.orders.read"]) {
  vi.mocked(usePermissions).mockReturnValue({ activeModules: modules, permissions: grants, can: (key) => grants.includes(key), isLoading: false, currentUser: null, error: null, refresh: vi.fn() })
}
function Location() { return <output data-testid="search">{useLocation().search}</output> }
function setup(search = "?visao=dia&date=2026-11-10") {
  return render(<MemoryRouter initialEntries={[`/agenda${search}`]}><AgendaPage /><Location /></MemoryRouter>)
}
function params() { return new URLSearchParams(screen.getByTestId("search").textContent ?? "") }

beforeEach(() => {
  vi.clearAllMocks()
  access()
  vi.mocked(listRentalAssetCategories).mockResolvedValue([{ id: categoryId, name: "Estúdio" }])
  vi.mocked(listCatalogProducts).mockResolvedValue([catalogProductSchema.parse({ id: productId, name: "Podcast", code: null, description: null, price: null, currency: "BRL", isActive: true, createdAt: "2026-11-10T12:00:00Z", files: [] })])
  vi.mocked(listCatalogOrders).mockResolvedValue([catalogOrderSchema.parse({ id: orderId, displayNumber: "#42", orderNumber: 42, status: "Requested", customerId: categoryId, customerName: "Ana", customerEmail: null, customerPhone: null, customerNote: null, totalAmount: null, currency: "BRL", rejectedReason: null, cancelledReason: null, createdAt: "2026-11-10T12:00:00Z", items: [], history: [] })])
})

describe("staff agenda shell", () => {
  it("writes stable chip IDs and removes the key with Todos", async () => {
    const user = userEvent.setup()
    setup("?visao=dia&date=2026-11-10&recurso=&recurso=duplicate&produto=")
    await user.click(await screen.findByRole("button", { name: "Estúdio" }))
    expect(params().getAll("recurso")).toEqual([categoryId])
    expect(params().has("produto")).toBe(false)
    await user.click(await screen.findByRole("button", { name: "Podcast" }))
    expect(params().get("produto")).toBe(productId)
    await user.click(await screen.findByRole("button", { name: /#42/ }))
    expect(params().get("pedido")).toBe(orderId)
    await user.click(screen.getByRole("button", { name: "Manutenção" }))
    expect(params().get("tipo")).toBe("manutencao")
    expect(screen.getByText("4 filtros aplicados")).toBeInTheDocument()
    await user.click(within(screen.getByRole("group", { name: "Recurso" })).getByRole("button", { name: "Todos" }))
    expect(params().has("recurso")).toBe(false)
  })
})


describe("staff agenda controls", () => {
  it("clears all four filters while keeping view, date and unrelated params", async () => {
    const user = userEvent.setup()
    setup(`?visao=semana&date=2026-11-10&recurso=${categoryId}&produto=${productId}&pedido=${orderId}&tipo=bloqueio&other=keep`)
    await user.click(screen.getByRole("button", { name: "Limpar filtros" }))
    expect(params().toString()).toBe("visao=semana&date=2026-11-10&other=keep")
    expect(screen.getByText("Nenhum filtro aplicado")).toBeInTheDocument()
  })

  it("moves by one day or seven days according to the selected view", async () => {
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByRole("button", { name: "Próximo" }))
    expect(params().get("date")).toBe("2026-11-11")
    await user.click(screen.getByRole("button", { name: "Semana" }))
    expect(params().get("visao")).toBe("semana")
    expect(screen.getByRole("button", { name: "Semana" })).toHaveAttribute("aria-pressed", "true")
    await user.click(screen.getByRole("button", { name: "Anterior" }))
    expect(params().get("date")).toBe("2026-11-04")
  })

  it("uses the tenant civil today even when UTC is already tomorrow", async () => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date("2026-11-11T01:00:00Z"))
    try {
      const user = userEvent.setup()
      render(<TenantTimeZoneContext.Provider value="America/Sao_Paulo"><MemoryRouter initialEntries={["/agenda?date=invalid"]}><AgendaPage /><Location /></MemoryRouter></TenantTimeZoneContext.Provider>)
      expect(screen.getByRole("button", { name: "Dia" })).toHaveAttribute("aria-pressed", "true")
      await user.click(screen.getByRole("button", { name: "Hoje" }))
      expect(params().get("date")).toBe("2026-11-10")
      expect(params().get("visao")).toBe("dia")
    } finally { vi.useRealTimers() }
  })

  it.each([
    { modules: [], grants: ["rentals.assets.read", "catalog.products.read", "catalog.orders.read"] },
    { modules: ["rentals", "catalog"], grants: ["rentals.reservations.read"] },
  ])("hides unavailable rows and never loads their options: $modules $grants", ({ modules, grants }) => {
    access(modules, grants)
    setup()
    for (const name of ["Recurso", "Produto", "Pedido"]) expect(screen.queryByRole("group", { name })).not.toBeInTheDocument()
    expect(screen.getByRole("group", { name: "Tipo" })).toBeInTheDocument()
    expect(listRentalAssetCategories).not.toHaveBeenCalled()
    expect(listCatalogProducts).not.toHaveBeenCalled()
    expect(listCatalogOrders).not.toHaveBeenCalled()
  })

  it("loads only rental categories with schedule permission alone", async () => {
    access(["rentals"], ["rentals.schedule.read"])
    setup()
    expect(await screen.findByRole("button", { name: "Estúdio" })).toBeInTheDocument()
    expect(screen.queryByRole("group", { name: "Produto" })).not.toBeInTheDocument()
    expect(screen.queryByRole("group", { name: "Pedido" })).not.toBeInTheDocument()
    expect(listCatalogProducts).not.toHaveBeenCalled()
    expect(listCatalogOrders).not.toHaveBeenCalled()
  })

  it("reports an option load failure while leaving other filters usable", async () => {
    vi.mocked(listRentalAssetCategories).mockRejectedValue(new Error("unavailable"))
    setup()
    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível carregar opções de Recurso.")
    expect(await screen.findByRole("button", { name: "Podcast" })).toBeInTheDocument()
  })
})
