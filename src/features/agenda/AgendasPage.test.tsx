import { screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, useLocation } from "react-router-dom"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { TenantTimeZoneContext } from "@/contexts/TenantTimeZoneContext"
import { usePermissions } from "@/features/users/permissions/PermissionContext"
import { listCatalogOrders, listCatalogProducts, listCatalogResourceAgenda } from "@/features/catalog/services/catalogService"
import { catalogOrderSchema, catalogProductSchema } from "@/features/catalog/schemas/catalogSchemas"
import { listAdminReservations } from "@/features/rentals/services/reservationsService"
import { fetchAdminScheduleDay, listAdminRentalAssets, listOccupancyKinds } from "@/features/rentals/services/scheduleService"
import { renderWithQuery } from "@/test/renderWithQuery"
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
  return renderWithQuery(<TenantTimeZoneContext.Provider value="America/Sao_Paulo"><MemoryRouter initialEntries={[`/agendas${search}`]}><AgendasPage view={view} /><Location /></MemoryRouter></TenantTimeZoneContext.Provider>)
}
function params() { return new URLSearchParams(screen.getByTestId("search").textContent ?? "") }
function chip(name: RegExp) { return within(screen.getByRole("group", { name: "Tipo" })).getByRole("button", { name }) }
function chips() { return within(screen.getByRole("group", { name: "Tipo" })).getAllByRole("button").map((button) => button.textContent?.trim()) }
function smallScreen() {
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })))
}
async function openFilters() { await userEvent.click(await screen.findByRole("button", { name: /recursos? selecionados?|^Filtros/ })) }
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

describe("agenda filters popover", () => {
  it("groups resources by category with a Sem categoria fallback and counts the selection", async () => {
    setup()
    await openFilters()
    expect(await within(tree()).findByText("Estúdio B")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Recursos · 3 de 3" })).toBeInTheDocument()
    expect(within(within(tree()).getByRole("group", { name: "Estúdios" })).getAllByRole("checkbox")).toHaveLength(3)
    expect(within(within(tree()).getByRole("group", { name: "Sem categoria" })).getByText("Câmera")).toBeInTheDocument()
  })

  it("toggles a whole group and shows the group as indeterminate when partial", async () => {
    setup()
    await openFilters()
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
    await openFilters()
    expect(await screen.findByRole("heading", { name: "Recursos · 1 de 3" })).toBeInTheDocument()
    expect(within(tree()).getByRole("checkbox", { name: "Estúdio B" })).toBeChecked()
    expect(within(tree()).getByRole("checkbox", { name: "Câmera" })).not.toBeChecked()
    unmount()
    setup(`?visao=dia&date=2026-11-10&recurso=${studioB.id}`)
    await openFilters()
    expect(await screen.findByRole("heading", { name: "Recursos · 1 de 3" })).toBeInTheDocument()
    await userEvent.click(within(tree()).getByRole("checkbox", { name: "Câmera" }))
    expect(params().has("recurso")).toBe(false)
    expect(params().get("recursos")?.split(",").sort()).toEqual([studioB.id, loose.id].sort())
  })

  it("searches the tree", async () => {
    setup()
    await openFilters()
    await within(tree()).findByText("Estúdio B")
    await userEvent.type(within(tree()).getByRole("textbox", { name: "Buscar recurso" }), "camera")
    expect(within(tree()).queryByText("Estúdio B")).not.toBeInTheDocument()
    expect(within(tree()).getByText("Câmera")).toBeInTheDocument()
  })

  it("selects a product, offers Todos os produtos and keeps the param name", async () => {
    setup()
    await openFilters()
    const select = await screen.findByRole("combobox", { name: "Produto" })
    await userEvent.click(select)
    expect(await screen.findByRole("option", { name: "Podcast" })).toBeInTheDocument()
    expect(screen.getByRole("option", { name: "Todos os produtos" })).toBeInTheDocument()
    await userEvent.click(screen.getByRole("option", { name: "Podcast" }))
    expect(params().get("produto")).toBe(productId)
    await userEvent.click(select)
    await userEvent.click(await screen.findByRole("option", { name: "Todos os produtos" }))
    expect(params().has("produto")).toBe(false)
  })

  it("requires a product in the product view and never offers all products", async () => {
    setup(undefined, "product")
    await openFilters()
    expect(screen.getByText("Escolha um produto para consultar sua agenda.")).toBeInTheDocument()
    const select = await screen.findByRole("combobox", { name: "Produto" })
    await userEvent.click(select)
    expect(screen.queryByRole("option", { name: "Todos os produtos" })).not.toBeInTheDocument()
    await userEvent.click(await screen.findByRole("option", { name: "Podcast" }))
    expect(params().get("produto")).toBe(productId)
    expect(screen.queryByText("Escolha um produto para consultar sua agenda.")).not.toBeInTheDocument()
  })

  it("stores the option flags in the URL (fechadas=1 shows all 24 hours)", async () => {
    setup()
    await openFilters()
    await userEvent.click(await screen.findByRole("checkbox", { name: "Só recursos com horário livre" }))
    expect(params().get("livres")).toBe("1")
    await userEvent.click(screen.getByRole("checkbox", { name: "Mostrar 24 horas" }))
    expect(params().get("fechadas")).toBe("1")
  })

  it("clears recursos, produto, tipo, search and options but keeps the period", async () => {
    setup(`?visao=semana&date=2026-11-10&recursos=${studioB.id}&produto=${productId}&tipo=pedido&pedido=${orderId}&livres=1&fechadas=1`)
    await openFilters()
    await userEvent.click(await screen.findByRole("button", { name: "Limpar filtros" }))
    expect(params().get("visao")).toBe("semana")
    expect(params().get("date")).toBe("2026-11-10")
    for (const key of ["recursos", "produto", "tipo", "pedido", "livres", "fechadas"]) expect(params().has(key)).toBe(false)
    expect(screen.queryByRole("button", { name: "Limpar filtros" })).not.toBeInTheDocument()
  })

  it("treats an unknown legacy recurso as all resources", async () => {
    setup("?visao=dia&date=2026-11-10&recurso=nope")
    await openFilters()
    expect(await screen.findByRole("heading", { name: "Recursos · 3 de 3" })).toBeInTheDocument()
  })

  it("opens the filters in a bottom Sheet below md from the same button", async () => {
    smallScreen()
    setup()
    expect(screen.queryByRole("region", { name: "Recursos" })).not.toBeInTheDocument()
    await userEvent.click(await screen.findByRole("button", { name: /recursos? selecionados?/ }))
    const dialog = await screen.findByRole("dialog")
    expect(within(dialog).getByRole("heading", { name: /Recursos · / })).toBeInTheDocument()
    await userEvent.click(await within(dialog).findByRole("checkbox", { name: "Estúdio B" }))
    expect(params().get("recursos")).toBeTruthy()
  })

  it("shows the selection count on the button and keeps the tree closed until it is opened", async () => {
    setup(`?visao=dia&date=2026-11-10&recursos=${studioB.id}`)
    expect(await screen.findByRole("button", { name: /^1 recurso selecionado/ })).toBeInTheDocument()
    expect(screen.queryByRole("region", { name: "Recursos" })).not.toBeInTheDocument()
    await openFilters()
    expect(await screen.findByRole("heading", { name: "Recursos · 1 de 3" })).toBeInTheDocument()
  })

  it("no longer keeps a collapsible left panel or its storage key", async () => {
    setup()
    await screen.findByRole("button", { name: /^3 recursos selecionados/ })
    expect(screen.queryByRole("button", { name: "Recolher filtros" })).not.toBeInTheDocument()
    expect(localStorage.getItem("rolvix.agenda.filters.collapsed")).toBeNull()
  })
})

describe("agenda card", () => {
  it("shows the date as a long label with the weekday, and the subtitle of the day view", async () => {
    setup("?visao=dia&date=2026-11-14")
    expect(screen.getByRole("button", { name: /Escolher data: 14 de novembro, 2026/ })).toBeInTheDocument()
    expect(screen.getByText("sábado")).toBeInTheDocument()
    expect(screen.getByText("Todos os seus recursos. Uma visão do dia.")).toBeInTheDocument()
  })

  it("shows the business hours of the visible resources on the info row", async () => {
    setup()
    expect(await screen.findByText("Horário comercial · 06:00 – 23:00")).toBeInTheDocument()
    // The axis follows them: first and last hour label.
    expect(await screen.findByText("06:00")).toBeInTheDocument()
    expect(screen.queryByText("00:00")).not.toBeInTheDocument()
  })

  it("says Horário variável when no resource declares hours", async () => {
    vi.mocked(listAdminRentalAssets).mockResolvedValue([{ ...studioA, openTime: null, closeTime: null }])
    setup()
    expect(await screen.findByText("Horário variável")).toBeInTheDocument()
  })

  it("shows 24 hours with fechadas=1 while keeping the business hours text", async () => {
    setup("?visao=dia&date=2026-11-10&fechadas=1")
    expect(await screen.findByText("Horário comercial · 06:00 – 23:00")).toBeInTheDocument()
    expect(screen.getByText("00:00")).toBeInTheDocument()
    expect(screen.getByText("23:00")).toBeInTheDocument()
  })

  it("counts resources and activities in the footer and lists the kinds present", async () => {
    setup()
    const footer = await screen.findByRole("contentinfo")
    expect(await within(footer).findByText("3 recursos")).toBeInTheDocument()
    expect(within(footer).getByText("2 atividades neste dia")).toBeInTheDocument()
    expect(within(footer).getByText("Pedidos")).toBeInTheDocument()
    expect(within(footer).getByText("Manutenção")).toBeInTheDocument()
    expect(within(footer).queryByText("Reservas")).not.toBeInTheDocument()
    expect(await within(footer).findByText("Atualizado agora")).toBeInTheDocument()
  })

  it("opens the create-reservation flow from an empty slot with the resource and slot time", async () => {
    access(["rentals", "catalog"], [...grants, "rentals.reservations.read"])
    setup()
    await userEvent.click(await screen.findByRole("button", { name: "Ver reservas de Câmera" }))
    const query = params()
    expect(query.get("rentalAssetId")).toBe(loose.id)
    expect(query.get("date")).toBe("2026-11-10")
    expect(query.get("startTime")).toMatch(/^\d{2}:00$/)
  })

  it("offers no empty-slot action without reservation access", async () => {
    setup()
    await screen.findByText("Horário comercial · 06:00 – 23:00")
    expect(screen.queryByRole("button", { name: /^Ver reservas de / })).not.toBeInTheDocument()
  })

  it("renders the week as the same card: resource column, day cells with counts, today tinted, a click opens the day", async () => {
    setup("?visao=semana&date=2026-11-10")
    const cell = await screen.findByRole("button", { name: "Estúdio A 2026-11-10 1 Pedido" })
    expect(within(cell).getByText("1")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /^Estúdio B 2026-11-10 \d+ Manutenção/ })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Câmera 2026-11-10 Livre" })).toBeInTheDocument()
    expect(screen.getByRole("contentinfo")).toHaveTextContent("nesta semana")
    expect(screen.getByText("Todos os seus recursos. Uma visão da semana.")).toBeInTheDocument()
    await userEvent.click(cell)
    expect(params().get("visao")).toBe("dia")
    expect(params().get("date")).toBe("2026-11-10")
  })
})

describe("agenda requests", () => {
  const total = () => [listAdminRentalAssets, listCatalogResourceAgenda, listCatalogOrders, listCatalogProducts, fetchAdminScheduleDay, listAdminReservations, listOccupancyKinds]
    .reduce((sum, fn) => sum + vi.mocked(fn).mock.calls.length, 0)

  it("loads orders once, without a range, for the labels and the order search; a day view in 6 requests", async () => {
    setup()
    await screen.findByRole("button", { name: /Pedidos\s*1/ })
    expect(listCatalogOrders).toHaveBeenCalledTimes(1)
    expect(vi.mocked(listCatalogOrders).mock.calls[0]![0]).toBeUndefined() // the API filters from/to by creation date
    expect(total()).toBe(6)
  })

  it("loads a week view in 12 requests", async () => {
    setup("?visao=semana&date=2026-11-10")
    await screen.findByRole("button", { name: /Pedidos\s*1/ })
    expect(listCatalogOrders).toHaveBeenCalledTimes(1)
    expect(total()).toBe(12)
  })

  it("finds an order created outside the visible range through the search", async () => {
    vi.mocked(listCatalogOrders).mockResolvedValue([catalogOrderSchema.parse({ id: orderId, displayNumber: "#7", orderNumber: 7, status: "Requested", customerId: productId, customerName: "Beatriz Antiga", customerEmail: null, customerPhone: null, customerNote: null, totalAmount: null, currency: "BRL", rejectedReason: null, cancelledReason: null, createdAt: "2025-01-02T12:00:00Z", items: [], history: [] })])
    setup()
    await userEvent.type(await screen.findByRole("combobox", { name: "Buscar pedido por número ou cliente" }), "Beatriz")
    expect(await screen.findByText(/#7 · Beatriz Antiga/)).toBeInTheDocument()
  })
})
