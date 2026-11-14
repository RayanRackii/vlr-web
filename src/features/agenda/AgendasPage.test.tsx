import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, useLocation } from "react-router-dom"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { TenantTimeZoneContext } from "@/contexts/TenantTimeZoneContext"
import { usePermissions } from "@/features/users/permissions/PermissionContext"
import { listCatalogOrders, listCatalogProducts, listCatalogResourceAgenda } from "@/features/catalog/services/catalogService"
import { catalogOrderSchema, catalogProductSchema } from "@/features/catalog/schemas/catalogSchemas"
import { fetchAdminScheduleDay, listAdminRentalAssets } from "@/features/rentals/services/scheduleService"
import { asset, order, slot } from "./agendaFixtures"
import { AgendasPage, type AgendasView } from "./AgendasPage"

vi.mock("@/features/users/permissions/PermissionContext", () => ({ usePermissions: vi.fn() }))
vi.mock("@/features/catalog/services/catalogService", () => ({
  listCatalogProducts: vi.fn(),
  listCatalogOrders: vi.fn(),
  listCatalogResourceAgenda: vi.fn(),
}))
vi.mock("@/features/rentals/services/scheduleService", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/rentals/services/scheduleService")>()),
  listAdminRentalAssets: vi.fn(),
  fetchAdminScheduleDay: vi.fn(),
  listOccupancyKinds: vi.fn().mockResolvedValue([]),
}))
vi.mock("@/features/rentals/services/reservationsService", () => ({
  listAdminReservations: vi.fn().mockResolvedValue([]),
}))
const productId = "22222222-2222-4222-8222-222222222222"
const orderId = "33333333-3333-4333-8333-333333333333"
const grants = ["rentals.assets.read", "rentals.schedule.read", "catalog.products.read", "catalog.orders.read"]
const studioA = { ...asset, categoryName: "Estúdios" }
const studioB = { ...asset, id: "11111111-1111-4111-8111-1111111111b1", name: "Estúdio B", categoryName: "Estúdios" }
const loose = { ...asset, id: "11111111-1111-4111-8111-1111111111c1", name: "Câmera", categoryId: null, categoryName: null }
function access(modules = ["rentals", "catalog"], granted = grants) {
  vi.mocked(usePermissions).mockReturnValue({ activeModules: modules, permissions: granted, can: (key) => granted.includes(key), isLoading: false, currentUser: null, error: null, refresh: vi.fn() })
}
function Location() { return <output data-testid="search">{useLocation().search}</output> }
function setup(search = "?visao=dia&date=2026-11-10", view: AgendasView = "overview") {
  return render(<TenantTimeZoneContext.Provider value="America/Sao_Paulo"><MemoryRouter initialEntries={[`/agendas${search}`]}><AgendasPage view={view} /><Location /></MemoryRouter></TenantTimeZoneContext.Provider>)
}
function params() { return new URLSearchParams(screen.getByTestId("search").textContent ?? "") }
function chip(name: RegExp) { return within(screen.getByRole("group", { name: "Tipo" })).getByRole("button", { name }) }
function chips() { return within(screen.getByRole("group", { name: "Tipo" })).getAllByRole("button").map((button) => button.textContent?.trim()) }
function smallScreen() {
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })))
}
function tree() { return screen.getByRole("region", { name: "Recursos" }) }

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  access()
  vi.mocked(listAdminRentalAssets).mockResolvedValue([studioA, studioB, loose])
  vi.mocked(listCatalogResourceAgenda).mockResolvedValue({ resources: [], items: [order] })
  vi.mocked(fetchAdminScheduleDay).mockResolvedValue({ date: "2026-11-10", slots: [slot({ occupancyKindKey: "maintenance", rentalAssetId: studioB.id, assetName: studioB.name })] })
  vi.mocked(listCatalogProducts).mockResolvedValue([catalogProductSchema.parse({ id: productId, name: "Podcast", code: null, description: null, price: null, currency: "BRL", isActive: true, createdAt: "2026-11-10T12:00:00Z", files: [] })])
  vi.mocked(listCatalogOrders).mockResolvedValue([catalogOrderSchema.parse({ id: orderId, displayNumber: "#42", orderNumber: 42, status: "Requested", customerId: productId, customerName: "Ana", customerEmail: null, customerPhone: null, customerNote: null, totalAmount: null, currency: "BRL", rejectedReason: null, cancelledReason: null, createdAt: "2026-11-10T12:00:00Z", items: [], history: [] })])
})
afterEach(() => { vi.unstubAllGlobals() })

describe("agenda overview toolbar", () => {
  it.each([
    ["overview", "Visão geral das agendas"], ["resources", "Agenda de recursos"], ["product", "Agenda do produto"],
  ] as const)("renders one title and the date navigator for %s", (view, title) => {
    setup(undefined, view)
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1)
    expect(screen.getByRole("heading", { level: 1, name: title })).toBeInTheDocument()
    expect(screen.getByText("Operação · Agendas")).toBeInTheDocument()
    const dateNav = screen.getByRole("group", { name: "Navegação por data" })
    expect(within(dateNav).getByText("Dia")).toBeInTheDocument()
    expect(within(dateNav).getByText("Semana")).toBeInTheDocument()
    expect(within(dateNav).getByRole("button", { name: "Hoje" })).toBeInTheDocument()
  })

  it("steps the date by a day or a week and switches the view", async () => {
    setup()
    await userEvent.click(screen.getByRole("button", { name: "Próximo dia" }))
    expect(params().get("date")).toBe("2026-11-11")
    await userEvent.click(within(screen.getByRole("group", { name: "Navegação por data" })).getByText("Semana"))
    expect(params().get("visao")).toBe("semana")
    await userEvent.click(screen.getByRole("button", { name: "Semana anterior" }))
    expect(params().get("date")).toBe("2026-11-04")
  })

  it("shows header actions only with the matching permissions", () => {
    access(["rentals", "catalog"], [...grants, "rentals.reservations.read"])
    setup()
    expect(screen.getByRole("link", { name: "Nova reserva" })).toHaveAttribute("href", "/configuracoes/reservas")
    expect(screen.getByRole("link", { name: "Bloquear período" })).toHaveAttribute("href", "/configuracoes/agenda")
  })

  it("hides the header actions without reservation or schedule access", () => {
    access(["rentals", "catalog"], ["rentals.assets.read", "catalog.orders.read"])
    setup()
    expect(screen.queryByRole("link", { name: "Nova reserva" })).not.toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "Bloquear período" })).not.toBeInTheDocument()
  })

  it("lists Todos first, then Pedidos, Reservas, Manutenção, Bloqueios, with counts", async () => {
    setup()
    expect(await screen.findByRole("button", { name: /Pedidos\s*1/ })).toBeInTheDocument()
    expect(chips()).toEqual(["Todos2", "Pedidos1", "Reservas0", "Manutenção1", "Bloqueios0"])
  })

  it("selects one type chip, writes tipo and keeps the counts of every type", async () => {
    setup()
    await screen.findByRole("button", { name: /Pedidoss*1/ })
    await userEvent.click(chip(/Manutenção/))
    expect(params().get("tipo")).toBe("manutencao")
    expect(chip(/Manutenção/)).toHaveAttribute("aria-pressed", "true")
    expect(chips()).toEqual(["Todos2", "Pedidos1", "Reservas0", "Manutenção1", "Bloqueios0"])
    await userEvent.click(chip(/Todos/))
    expect(params().has("tipo")).toBe(false)
  })

  it("keeps the order search next to the chips", () => {
    setup()
    expect(screen.getByRole("combobox", { name: "Buscar pedido por número ou cliente" })).toBeInTheDocument()
  })
})

describe("agenda filter panel", () => {
  it("groups resources by category with a Sem categoria fallback and counts the selection", async () => {
    setup()
    expect(await within(tree()).findByText("Estúdio B")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Recursos · 3 de 3" })).toBeInTheDocument()
    expect(within(within(tree()).getByRole("group", { name: "Estúdios" })).getAllByRole("checkbox")).toHaveLength(3)
    expect(within(within(tree()).getByRole("group", { name: "Sem categoria" })).getByText("Câmera")).toBeInTheDocument()
  })

  it("toggles a whole group and shows the group as indeterminate when partial", async () => {
    setup()
    const group = await within(tree()).findByRole("checkbox", { name: "Todos os recursos de Estúdios" })
    await userEvent.click(group)
    expect(params().get("recursos")).toBe(loose.id)
    expect(screen.getByRole("heading", { name: "Recursos · 1 de 3" })).toBeInTheDocument()
    await userEvent.click(within(tree()).getByRole("checkbox", { name: "Estúdio B" }))
    expect(params().get("recursos")?.split(",").sort()).toEqual([studioB.id, loose.id].sort())
    expect(within(tree()).getByRole("checkbox", { name: "Todos os recursos de Estúdios" })).toHaveProperty("indeterminate", true)
    await userEvent.click(within(tree()).getByRole("checkbox", { name: "Estúdio B" }))
    await userEvent.click(within(tree()).getByRole("checkbox", { name: "Câmera" }))
    // Nothing selected falls back to every resource instead of an empty agenda.
    expect(params().has("recursos")).toBe(false)
  })

  it("reads recursos from the URL and the legacy recurso param", async () => {
    const { unmount } = setup(`?visao=dia&date=2026-11-10&recursos=${studioB.id}`)
    expect(await screen.findByRole("heading", { name: "Recursos · 1 de 3" })).toBeInTheDocument()
    expect(within(tree()).getByRole("checkbox", { name: "Estúdio B" })).toBeChecked()
    expect(within(tree()).getByRole("checkbox", { name: "Câmera" })).not.toBeChecked()
    unmount()
    setup(`?visao=dia&date=2026-11-10&recurso=${studioB.id}`)
    expect(await screen.findByRole("heading", { name: "Recursos · 1 de 3" })).toBeInTheDocument()
    await userEvent.click(within(tree()).getByRole("checkbox", { name: "Câmera" }))
    expect(params().has("recurso")).toBe(false)
    expect(params().get("recursos")?.split(",").sort()).toEqual([studioB.id, loose.id].sort())
  })

  it("searches the tree", async () => {
    setup()
    await within(tree()).findByText("Estúdio B")
    await userEvent.type(within(tree()).getByRole("textbox", { name: "Buscar recurso" }), "camera")
    expect(within(tree()).queryByText("Estúdio B")).not.toBeInTheDocument()
    expect(within(tree()).getByText("Câmera")).toBeInTheDocument()
  })

  it("selects a product, offers Todos os produtos and keeps the param name", async () => {
    setup()
    const select = await screen.findByRole("combobox", { name: "Produto" })
    expect(await within(select).findByRole("option", { name: "Podcast" })).toBeInTheDocument()
    expect(within(select).getByRole("option", { name: "Todos os produtos" })).toBeInTheDocument()
    await userEvent.selectOptions(select, "Podcast")
    expect(params().get("produto")).toBe(productId)
    await userEvent.selectOptions(select, "Todos os produtos")
    expect(params().has("produto")).toBe(false)
  })

  it("requires a product in the product view and never offers all products", async () => {
    setup(undefined, "product")
    expect(screen.getByText("Escolha um produto para consultar sua agenda.")).toBeInTheDocument()
    const select = await screen.findByRole("combobox", { name: "Produto" })
    expect(within(select).queryByRole("option", { name: "Todos os produtos" })).not.toBeInTheDocument()
    await within(select).findByRole("option", { name: "Podcast" })
    await userEvent.selectOptions(select, "Podcast")
    expect(params().get("produto")).toBe(productId)
    expect(screen.queryByText("Escolha um produto para consultar sua agenda.")).not.toBeInTheDocument()
  })

  it("stores the option flags in the URL", async () => {
    setup()
    await userEvent.click(await screen.findByRole("checkbox", { name: "Só recursos com horário livre" }))
    expect(params().get("livres")).toBe("1")
    await userEvent.click(screen.getByRole("checkbox", { name: "Mostrar horas fechadas" }))
    expect(params().get("fechadas")).toBe("0")
  })

  it("clears recursos, produto, tipo, search and options but keeps the period", async () => {
    setup(`?visao=semana&date=2026-11-10&recursos=${studioB.id}&produto=${productId}&tipo=pedido&pedido=${orderId}&livres=1&fechadas=0`)
    await userEvent.click(await screen.findByRole("button", { name: "Limpar filtros" }))
    expect(params().get("visao")).toBe("semana")
    expect(params().get("date")).toBe("2026-11-10")
    for (const key of ["recursos", "produto", "tipo", "pedido", "livres", "fechadas"]) expect(params().has(key)).toBe(false)
    expect(screen.queryByRole("button", { name: "Limpar filtros" })).not.toBeInTheDocument()
  })

  it("remembers the collapsed state per viewer", async () => {
    const { unmount } = setup()
    await userEvent.click(await screen.findByRole("button", { name: "Recolher filtros" }))
    expect(screen.queryByRole("region", { name: "Recursos" })).not.toBeInTheDocument()
    expect(localStorage.getItem("rolvix.agenda.filters.collapsed")).toBe("1")
    unmount()
    setup()
    expect(await screen.findByRole("button", { name: "Mostrar filtros" })).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Mostrar filtros" }))
    expect(screen.getByRole("region", { name: "Recursos" })).toBeInTheDocument()
    expect(localStorage.getItem("rolvix.agenda.filters.collapsed")).toBe("0")
  })

  it("keeps keyboard focus on the toggle when collapsing and expanding", async () => {
    setup()
    await userEvent.click(await screen.findByRole("button", { name: "Recolher filtros" }))
    expect(screen.getByRole("button", { name: "Mostrar filtros" })).toHaveFocus()
    await userEvent.click(screen.getByRole("button", { name: "Mostrar filtros" }))
    expect(screen.getByRole("button", { name: "Recolher filtros" })).toHaveFocus()
  })

  it("treats an unknown legacy recurso as all resources", async () => {
    setup("?visao=dia&date=2026-11-10&recurso=nope")
    expect(await screen.findByRole("heading", { name: "Recursos · 3 de 3" })).toBeInTheDocument()
  })

  it("still works when localStorage throws", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked") })
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked") })
    try {
      setup()
      await userEvent.click(await screen.findByRole("button", { name: "Recolher filtros" }))
      expect(screen.getByRole("button", { name: "Mostrar filtros" })).toBeInTheDocument()
    } finally { vi.restoreAllMocks() }
  })

  it("opens the filters in a Sheet below lg from the Filtros button", async () => {
    smallScreen()
    setup()
    expect(screen.queryByRole("region", { name: "Recursos" })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: /^Filtros/ }))
    const dialog = await screen.findByRole("dialog")
    expect(within(dialog).getByRole("heading", { name: /Recursos · / })).toBeInTheDocument()
    await userEvent.click(await within(dialog).findByRole("checkbox", { name: "Estúdio B" }))
    expect(params().get("recursos")).toBeTruthy()
  })
})
