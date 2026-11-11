import { render, screen } from "@testing-library/react"
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
  it("searches, selects one value per filter, and writes it to the URL", async () => {
    const user = userEvent.setup()
    setup("?visao=dia&date=2026-11-10&produto=")
    await user.click(screen.getByRole("button", { name: "Recurso" }))
    await user.type(screen.getByRole("textbox", { name: "Buscar recurso" }), "zzz")
    expect(screen.getByText("Nenhum resultado para “zzz”.")).toBeInTheDocument()
    await user.clear(screen.getByRole("textbox", { name: "Buscar recurso" }))
    await user.type(screen.getByRole("textbox", { name: "Buscar recurso" }), "est")
    await user.click(await screen.findByRole("option", { name: "Estúdio" }))
    expect(params().getAll("recurso")).toEqual([categoryId])
    expect(params().has("produto")).toBe(false)
    await user.click(screen.getByRole("button", { name: "Produto" }))
    await user.type(screen.getByRole("textbox", { name: "Buscar produto" }), "pod")
    await user.click(await screen.findByRole("option", { name: "Podcast" }))
    expect(params().get("produto")).toBe(productId)
    await user.click(screen.getByRole("combobox", { name: "Buscar pedido por número ou cliente" }))
    await user.type(screen.getByRole("combobox", { name: "Buscar pedido por número ou cliente" }), "ana")
    await user.click(await screen.findByRole("option", { name: "#42 · Ana" }))
    expect(params().get("pedido")).toBe(orderId)
    await user.click(screen.getByRole("button", { name: "Manutenção" }))
    expect(params().get("tipo")).toBe("manutencao")
    expect(screen.getByText("4 filtros aplicados")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Remover Estúdio" }))
    expect(params().has("recurso")).toBe(false)
    await user.click(screen.getByRole("button", { name: "Todos" }))
    expect(params().has("tipo")).toBe(false)
  })
})


describe("staff agenda controls", () => {
  it("clears all four filters while keeping view, date and unrelated params", async () => {
    const user = userEvent.setup()
    setup(`?visao=semana&date=2026-11-10&recurso=${categoryId}&produto=${productId}&pedido=${orderId}&tipo=bloqueio&other=keep`)
    await user.click(screen.getByRole("button", { name: "Limpar" }))
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
    expect(screen.queryByRole("button", { name: "Recurso" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Produto" })).not.toBeInTheDocument()
    expect(screen.queryByRole("combobox", { name: "Buscar pedido por número ou cliente" })).not.toBeInTheDocument()
    expect(screen.getByRole("group", { name: "Tipo" })).toBeInTheDocument()
    expect(listRentalAssetCategories).not.toHaveBeenCalled()
    expect(listCatalogProducts).not.toHaveBeenCalled()
    expect(listCatalogOrders).not.toHaveBeenCalled()
  })

  it("loads only rental categories with schedule permission alone", async () => {
    const user = userEvent.setup()
    access(["rentals"], ["rentals.schedule.read"])
    setup()
    await user.click(screen.getByRole("button", { name: "Recurso" }))
    expect(await screen.findByRole("option", { name: "Estúdio" })).toBeInTheDocument()
    expect(screen.queryByRole("group", { name: "Produto" })).not.toBeInTheDocument()
    expect(screen.queryByRole("group", { name: "Pedido" })).not.toBeInTheDocument()
    expect(listCatalogProducts).not.toHaveBeenCalled()
    expect(listCatalogOrders).not.toHaveBeenCalled()
  })

  it("reports an option load failure while leaving other filters usable", async () => {
    vi.mocked(listRentalAssetCategories).mockRejectedValue(new Error("unavailable"))
    setup()
    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível carregar opções de Recurso.")
    const user = userEvent.setup()
    await user.click(screen.getByRole("button", { name: "Produto" }))
    expect(await screen.findByRole("option", { name: "Podcast" })).toBeInTheDocument()
  })

  it("opens the phone filters in the page instead of a side panel", async () => {
    const user = userEvent.setup()
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query === "(max-width: 639px)",
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }))
    try {
      setup(`?visao=dia&date=2026-11-10&recurso=${categoryId}&tipo=reserva`)
      const filters = screen.getByRole("button", { name: /Filtros/ })
      expect(filters).toHaveAttribute("aria-expanded", "false")
      expect(screen.queryByRole("group", { name: "Tipo" })).not.toBeInTheDocument()
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
      await user.click(filters)
      expect(filters).toHaveAttribute("aria-expanded", "true")
      expect(screen.getByRole("group", { name: "Tipo" })).toBeInTheDocument()
      expect(screen.getByRole("button", { name: "Ver agenda" })).toBeInTheDocument()
      await user.click(screen.getByRole("button", { name: "Ver agenda" }))
      expect(filters).toHaveAttribute("aria-expanded", "false")
    } finally {
      vi.unstubAllGlobals()
    }
  })
})

// Low — `src/features/agenda/AgendaPage.tsx:37`: carregamento inicial usa texto; `CONTEXT.md` §6 exige Skeleton com shimmer. Preserve o status acessível.
it("uses shimmer Skeletons with an accessible status while chips load", () => {
  vi.mocked(listRentalAssetCategories).mockReturnValue(new Promise(() => {}))
  setup("?visao=semana&date=2026-11-10")
  const loading = screen.getByRole("status", { name: "Carregando opções de Recurso…" })
  expect(loading.querySelector('[data-slot="skeleton"][data-variant="shimmer"]')).toBeInTheDocument()
})
