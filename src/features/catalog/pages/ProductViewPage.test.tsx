import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom"
import { toast } from "sonner"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { useProductWizard } from "@/features/catalog/components/productWizard/useProductWizard"
import { ProductViewPage } from "@/features/catalog/pages/ProductViewPage"
import {
  activateCatalogProduct,
  deactivateCatalogProduct,
  deleteCatalogProduct,
  duplicateCatalogProduct,
  getCatalogProductHistory,
} from "@/features/catalog/services/catalogService"
import { TestPermissionProvider } from "@/features/users/permissions/PermissionContext"
import i18n from "@/lib/i18n"

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

vi.mock("@/features/catalog/components/productWizard/useProductWizard", () => ({ useProductWizard: vi.fn() }))

vi.mock("@/features/catalog/services/catalogService", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/catalog/services/catalogService")>()),
  activateCatalogProduct: vi.fn(),
  deactivateCatalogProduct: vi.fn(),
  deleteCatalogProduct: vi.fn(),
  duplicateCatalogProduct: vi.fn(),
  getCatalogProductFileUrl: vi.fn().mockResolvedValue({ url: "https://files.test/signed", isPublic: false }),
  getCatalogProductHistory: vi.fn(),
}))

vi.mock("@/features/rentals/services/scheduleService", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/rentals/services/scheduleService")>()),
  listAdminRentalAssets: vi.fn().mockResolvedValue([
    { id: "asset-1", name: "Impressora 3D", queueEnabled: false, queueOpeningTime: null },
  ]),
}))

const ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const COPY_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"

const DESCRIPTION = "Peça de reposição impressa em 3D para mecanismos e equipamentos compatíveis."

type Overrides = {
  product?: Record<string, unknown>
  access?: Record<string, unknown> | null
  requirements?: unknown[] | null
  canManage?: boolean
  rentalsActive?: boolean
}

function image(id: string, extra: Record<string, unknown> = {}) {
  return { id, fileName: `${id}.jpg`, mimeType: "image/jpeg", sizeBytes: 1000, visibility: "CustomerVisible", status: "Ready", url: `https://img.test/${id}.jpg`, ...extra }
}

function pdf(id: string, fileName: string, extra: Record<string, unknown> = {}) {
  return { id, fileName, mimeType: "application/pdf", sizeBytes: 2 * 1024 * 1024, visibility: "InternalB2B", status: "Ready", url: null, ...extra }
}

function mockWizard({ product = {}, access, requirements = [], canManage = true, rentalsActive = false }: Overrides = {}) {
  const reload = vi.fn().mockResolvedValue(undefined)
  vi.mocked(useProductWizard).mockReturnValue({
    loading: false,
    error: null,
    busy: false,
    rentalsActive,
    canManage,
    canSearchCustomers: false,
    wizardPath: `/catalogo/produtos/${ID}/cadastro`,
    reload,
    publishMenu: vi.fn(),
    modelRef: { current: null },
    model: {
      product: {
        id: ID,
        name: "Engrenagem plástica de reposição",
        code: "EPR",
        description: DESCRIPTION,
        price: 45,
        currency: "BRL",
        isActive: true,
        usesSchedule: false,
        createdAt: "2026-10-14T12:00:00.000Z",
        updatedAt: "2026-11-12T17:30:00.000Z",
        files: [image("img-1")],
        visibility: "Public",
        grantedCustomerCount: 0,
        grantedGroupCount: 0,
        taxonomy: { categories: [{ id: "c1", name: "Peças de reposição" }], tags: [{ id: "t1", name: "Impressão 3D" }] },
        saleReadiness: { ready: true, missing: [] },
        ...product,
      },
      access: access === undefined ? { visibility: "Public", customerIds: [], groupIds: [] } : access,
      groups: [{ id: "g1", name: "Clientes VIP" }],
      menuItems: [],
      requirements,
      resourceCapability: "ready",
    },
  } as never)
  return { reload }
}

function LocationProbe() {
  const location = useLocation()
  return <p data-testid="location">{location.pathname}{location.search}</p>
}

function renderPage(permissions = ["catalog.products.read", "catalog.products.manage", "catalog.orders.read"]) {
  return render(
    <MemoryRouter initialEntries={[`/catalogo/produtos/${ID}`]}>
      <TestPermissionProvider permissions={permissions}>
        <Routes>
          <Route path="/catalogo/produtos/:id" element={<><ProductViewPage /><LocationProbe /></>} />
          <Route path="/catalogo/produtos/:id/*" element={<LocationProbe />} />
          <Route path="/catalogo/produtos" element={<LocationProbe />} />
        </Routes>
      </TestPermissionProvider>
    </MemoryRouter>,
  )
}

async function openMenu(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Mais ações" }))
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getCatalogProductHistory).mockResolvedValue([])
})

afterEach(async () => {
  await i18n.changeLanguage("pt-BR")
})

function before(a: Element, b: Element) {
  return Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)
}

describe("ProductViewPage layout", () => {
  it("shows the header actions, the summary in the specified order and no Salvar button", () => {
    mockWizard()
    renderPage()

    const edit = screen.getByRole("link", { name: "Editar produto" })
    expect(edit).toHaveAttribute("href", `/catalogo/produtos/${ID}/cadastro`)
    expect(screen.getByRole("button", { name: "Mais ações" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /^salvar/i })).not.toBeInTheDocument()

    const status = screen.getByText("Ativo")
    const name = screen.getByRole("heading", { level: 2, name: "Engrenagem plástica de reposição" })
    const code = screen.getByText("Código interno: EPR")
    const description = screen.getByTestId("product-view-short-description")
    const price = screen.getByTestId("product-view-price")
    const availability = screen.getByTestId("product-view-availability")
    const portal = screen.getByTestId("product-view-portal")
    expect(price).toHaveTextContent("R$ 45,00")
    expect(screen.queryByText(/por unidade/i)).not.toBeInTheDocument()
    expect(portal).toHaveTextContent("Disponível no portal do cliente")
    const ordered = [status, name, code, description, price, screen.getByText("Peças de reposição", { selector: "p" }), availability, portal]
    for (let index = 0; index < ordered.length - 1; index += 1) {
      expect(before(ordered[index]!, ordered[index + 1]!)).toBe(true)
    }
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual(["Visão geral", "Operação", "Histórico"])
  })

  it("splits 60/40 on lg and stacks below lg with status, name and Editar produto first", () => {
    mockWizard()
    renderPage()

    const main = screen.getByTestId("product-view-main")
    expect(main.className).toContain("lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]")
    expect(main.className).toContain("min-w-0")
    const head = screen.getByTestId("product-view-summary-head")
    const gallery = screen.getByTestId("product-view-gallery").parentElement!
    const body = screen.getByTestId("product-view-summary-body")
    // Below lg the order classes stack head, gallery, body; lg+ restores the two columns.
    expect(head.className).toContain("order-1")
    expect(gallery.className).toContain("order-2")
    expect(body.className).toContain("order-3")
    expect(gallery.className).toContain("lg:col-start-1")
    expect(head.className).toContain("lg:col-start-2")
    expect(before(screen.getByTestId("product-view-actions"), head)).toBe(true)
    // The primary action fills the row on mobile.
    expect(screen.getByRole("link", { name: "Editar produto" }).className).toContain("flex-1")
    expect(screen.getByTestId("product-view").className).toContain("min-w-0")
    // Tabs scroll inside their own bar instead of the page.
    expect(screen.getByRole("tablist").className).toContain("overflow-x-auto")
    expect(screen.getByRole("heading", { level: 1, name: "Detalhes do produto" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { level: 2, name: "Engrenagem plástica de reposição" }).className).toContain("break-words")
  })

  it("fills the overview tab with the full description and the registration card", () => {
    mockWizard()
    renderPage()
    const panel = screen.getByRole("tabpanel")
    expect(within(panel).getByRole("heading", { name: "Sobre o produto" })).toBeInTheDocument()
    expect(within(panel).getByTestId("product-view-full-description")).toHaveTextContent(DESCRIPTION)
    const info = within(panel).getByRole("heading", { name: "Informações do cadastro" }).closest("section")!
    const card = within(info)
    expect(card.getByText("Código interno").nextSibling).toHaveTextContent("EPR")
    expect(card.getByText("Categoria").nextSibling).toHaveTextContent("Peças de reposição")
    expect(card.getByText("Tags").nextSibling).toHaveTextContent("Impressão 3D")
    expect(card.getByText("Visibilidade").nextSibling).toHaveTextContent("Portal do cliente")
    expect(card.getByText("Criado em")).toBeInTheDocument()
    expect(card.getByText("Atualizado em")).toBeInTheDocument()
  })
})

describe("ProductViewPage states", () => {
  it("shows no thumbnails for a single photo and a thumbnail strip, selection and lightbox for several", async () => {
    mockWizard()
    const { unmount } = renderPage()
    expect(screen.getByTestId("product-view-main-image")).toHaveAttribute("src", "https://img.test/img-1.jpg")
    expect(screen.getByTestId("product-view-main-image").className).toContain("object-contain")
    expect(screen.queryByRole("button", { name: /Foto 1 de/ })).not.toBeInTheDocument()
    unmount()

    mockWizard({ product: { files: [image("img-1"), image("img-2"), pdf("doc-1", "manual.pdf")] } })
    const user = userEvent.setup()
    renderPage()
    const thumbs = screen.getAllByRole("button", { name: /^Foto \d de 2$/ })
    expect(thumbs).toHaveLength(2)
    expect(thumbs[0]).toHaveAttribute("aria-current", "true")
    await user.click(thumbs[1]!)
    expect(screen.getByTestId("product-view-main-image")).toHaveAttribute("src", "https://img.test/img-2.jpg")
    expect(thumbs[1]).toHaveAttribute("aria-current", "true")
    await user.click(screen.getByTestId("product-view-main-image"))
    const dialog = await screen.findByRole("dialog")
    expect(within(dialog).getByRole("img", { name: "Engrenagem plástica de reposição" })).toHaveAttribute("src", "https://img.test/img-2.jpg")
  })

  it("uses a compact summary-first layout without photos and links managers to the photos step", () => {
    mockWizard({ product: { files: [] } })
    renderPage()
    expect(screen.queryByTestId("product-view-gallery")).not.toBeInTheDocument()
    expect(screen.getByTestId("product-view-main").className).not.toContain("lg:grid-cols")
    const note = screen.getByTestId("product-view-no-photo")
    expect(note).toHaveTextContent("Sem foto cadastrada")
    expect(within(note).getByRole("link", { name: "Adicionar fotos" })).toHaveAttribute("href", `/catalogo/produtos/${ID}/cadastro?passo=arquivos`)
  })

  it("hides the add-photos link when the user cannot manage", () => {
    mockWizard({ product: { files: [] }, canManage: false })
    renderPage(["catalog.products.read"])
    expect(screen.getByTestId("product-view-no-photo")).toHaveTextContent("Sem foto cadastrada")
    expect(screen.queryByRole("link", { name: "Adicionar fotos" })).not.toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "Editar produto" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Mais ações" })).not.toBeInTheDocument()
  })

  it("shows Sob consulta when there is no price", () => {
    mockWizard({ product: { price: null } })
    renderPage()
    expect(screen.getByTestId("product-view-price")).toHaveTextContent("Sob consulta")
  })

  it("explains an inactive product and what is missing", () => {
    mockWizard({ product: { isActive: false, saleReadiness: { ready: false, missing: ["PRICE", "RESOURCE"] } } })
    renderPage()
    const banner = screen.getByTestId("product-view-banner")
    expect(banner).toHaveTextContent("Este produto está inativo: os clientes não o veem.")
    expect(banner).toHaveTextContent("Falta: preço maior que zero, um recurso na agenda.")
    expect(screen.getByText("Inativo")).toBeInTheDocument()
    expect(screen.getByText("Configuração incompleta")).toBeInTheDocument()
    expect(screen.getByTestId("product-view-portal")).toHaveTextContent("Inativo — clientes não veem")
    expect(within(banner).getByRole("link", { name: "Concluir cadastro" })).toHaveAttribute("href", `/catalogo/produtos/${ID}/cadastro`)
  })

  it("flags an active but incomplete product", () => {
    mockWizard({ product: { saleReadiness: { ready: false, missing: ["AUDIENCE"] } } })
    renderPage()
    expect(screen.getByTestId("product-view-banner")).toHaveTextContent("O cadastro está incompleto")
    expect(screen.getByTestId("product-view-banner")).toHaveTextContent("quem pode ver (clientes ou grupos)")
  })

  it("shows the restricted portal line", () => {
    mockWizard({ product: { visibility: "Restricted" }, access: { visibility: "Restricted", customerIds: ["x"], groupIds: ["g1"] } })
    renderPage()
    expect(screen.getByTestId("product-view-portal")).toHaveTextContent("Restrito a grupos e clientes liberados")
  })

  it("shortens a long description with Ver mais while the overview keeps the full text", async () => {
    const long = `${"Descrição longa de produto. ".repeat(30)}FIM`
    mockWizard({ product: { description: long } })
    const user = userEvent.setup()
    renderPage()
    const summary = screen.getByTestId("product-view-short-description")
    expect(summary.textContent!.length).toBeLessThan(260)
    expect(summary.textContent).toMatch(/…$/)
    expect(screen.getByTestId("product-view-full-description").textContent).toContain("FIM")
    await user.click(screen.getByRole("button", { name: "Ver mais" }))
    expect(screen.getByTestId("product-view-short-description").textContent).toContain("FIM")
    await user.click(screen.getByRole("button", { name: "Ver menos" }))
    expect(screen.getByTestId("product-view-short-description").textContent).toMatch(/…$/)
  })

  it("hides empty blocks: no description, tags, category, files or update date", () => {
    mockWizard({ product: { description: null, taxonomy: { categories: [], tags: [] }, updatedAt: null, code: null, files: [image("img-1")] } })
    renderPage()
    expect(screen.queryByTestId("product-view-short-description")).not.toBeInTheDocument()
    expect(screen.queryByTestId("product-view-full-description")).not.toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: "Sobre o produto" })).not.toBeInTheDocument()
    expect(screen.queryByRole("tab", { name: "Arquivos" })).not.toBeInTheDocument()
    expect(screen.queryByText(/Código interno/)).not.toBeInTheDocument()
    expect(screen.queryByText("Tags")).not.toBeInTheDocument()
    expect(screen.queryByText("Categoria")).not.toBeInTheDocument()
    expect(screen.queryByText("Atualizado em")).not.toBeInTheDocument()
    expect(screen.getByText("Visibilidade")).toBeInTheDocument()
  })

  it("shows the agenda availability with the linked resources and a link to the agenda", async () => {
    mockWizard({
      rentalsActive: true,
      product: { usesSchedule: true },
      requirements: [{ id: "r1", rentalAssetId: "asset-1", assetCategoryId: null, resourceQuantity: 2, durationMinutesPerUnit: 60, prepMinutes: 10, cleanupMinutes: 5 }],
    })
    const user = userEvent.setup()
    renderPage()
    expect(await screen.findByText("Usa agenda: Impressora 3D")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Ver agenda" })).toHaveAttribute("href", `/agendas/produto?produto=${ID}`)
    await user.click(screen.getByRole("tab", { name: "Operação" }))
    const panel = screen.getByRole("tabpanel")
    expect(await within(panel).findByText("Impressora 3D")).toBeInTheDocument()
    expect(within(panel).getByText("Qtd 2 · 60 min por unidade · Preparo 10 min · Limpeza 5 min")).toBeInTheDocument()
    expect(within(panel).getByText("Público: todos os clientes veem este produto.")).toBeInTheDocument()
  })

  it("says the product is sold without a schedule and hides Ver agenda", async () => {
    mockWizard({ product: { usesSchedule: false } })
    const user = userEvent.setup()
    renderPage()
    expect(screen.getByTestId("product-view-availability")).toHaveTextContent("Vendido sem agenda")
    expect(screen.queryByRole("link", { name: "Ver agenda" })).not.toBeInTheDocument()
    await user.click(screen.getByRole("tab", { name: "Operação" }))
    expect(within(screen.getByRole("tabpanel")).getByText("Este produto é vendido sem agenda.")).toBeInTheDocument()
  })

  it("lists internal documents in the Arquivos tab and keeps photos out of it", async () => {
    mockWizard({ product: { files: [image("img-1"), pdf("doc-1", "manual.pdf")] } })
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole("tab", { name: "Arquivos" }))
    const panel = screen.getByRole("tabpanel")
    expect(within(panel).getByText("manual.pdf")).toBeInTheDocument()
    expect(within(panel).getByText(/PDF · 2 MB/)).toBeInTheDocument()
    expect(within(panel).getByRole("button", { name: "Abrir" })).toBeInTheDocument()
    expect(within(panel).queryByText("img-1.jpg")).not.toBeInTheDocument()
  })
})

describe("ProductViewPage menu actions", () => {
  it("duplicates, shows the toast and opens the copy", async () => {
    mockWizard()
    vi.mocked(duplicateCatalogProduct).mockResolvedValue({ id: COPY_ID } as never)
    const user = userEvent.setup()
    renderPage()
    await openMenu(user)
    await user.click(await screen.findByRole("menuitem", { name: "Duplicar produto" }))
    await waitFor(() => expect(duplicateCatalogProduct).toHaveBeenCalledWith(ID))
    expect(toast.success).toHaveBeenCalledWith("Cópia criada (sem fotos).")
    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent(`/catalogo/produtos/${COPY_ID}`))
  })

  it("activates an inactive product and reloads", async () => {
    const { reload } = mockWizard({ product: { isActive: false } })
    vi.mocked(activateCatalogProduct).mockResolvedValue({} as never)
    const user = userEvent.setup()
    renderPage()
    await openMenu(user)
    await user.click(await screen.findByRole("menuitem", { name: "Ativar produto" }))
    await waitFor(() => expect(activateCatalogProduct).toHaveBeenCalledWith(ID))
    expect(toast.success).toHaveBeenCalledWith("Produto ativo.")
    await waitFor(() => expect(reload).toHaveBeenCalled())
  })

  it("shows the mapped message when activation is refused", async () => {
    mockWizard({ product: { isActive: false } })
    vi.mocked(activateCatalogProduct).mockRejectedValue(new Error("Não dá para ativar: falta preço maior que zero."))
    const user = userEvent.setup()
    renderPage()
    await openMenu(user)
    await user.click(await screen.findByRole("menuitem", { name: "Ativar produto" }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Não dá para ativar: falta preço maior que zero."))
  })

  it("keeps Ativar disabled with the missing items while the setup is incomplete", async () => {
    mockWizard({ product: { isActive: false, saleReadiness: { ready: false, missing: ["PRICE"] } } })
    const user = userEvent.setup()
    renderPage()
    await openMenu(user)
    const item = await screen.findByRole("menuitem", { name: /Ativar produto/ })
    expect(item).toHaveAttribute("aria-disabled", "true")
    expect(item).toHaveTextContent("Não dá para ativar: falta preço maior que zero.")
  })

  it("confirms before deactivating", async () => {
    const { reload } = mockWizard()
    vi.mocked(deactivateCatalogProduct).mockResolvedValue({} as never)
    const user = userEvent.setup()
    renderPage()
    await openMenu(user)
    await user.click(await screen.findByRole("menuitem", { name: "Desativar produto" }))
    expect(deactivateCatalogProduct).not.toHaveBeenCalled()
    const dialog = await screen.findByRole("dialog")
    expect(dialog).toHaveTextContent("Engrenagem plástica de reposição")
    await user.click(within(dialog).getByRole("button", { name: "Desativar" }))
    await waitFor(() => expect(deactivateCatalogProduct).toHaveBeenCalledWith(ID))
    expect(toast.success).toHaveBeenCalledWith("Produto desativado.")
    await waitFor(() => expect(reload).toHaveBeenCalled())
  })

  it("asks for confirmation naming the product, deletes and returns to the list", async () => {
    mockWizard()
    vi.mocked(deleteCatalogProduct).mockResolvedValue(undefined)
    const user = userEvent.setup()
    renderPage()
    await openMenu(user)
    await user.click(await screen.findByRole("menuitem", { name: "Excluir produto" }))
    expect(deleteCatalogProduct).not.toHaveBeenCalled()
    const dialog = await screen.findByRole("dialog")
    expect(dialog).toHaveTextContent("Excluir produto?")
    expect(dialog).toHaveTextContent("Engrenagem plástica de reposição será excluído em definitivo")
    await user.click(within(dialog).getByRole("button", { name: "Excluir" }))
    await waitFor(() => expect(deleteCatalogProduct).toHaveBeenCalledWith(ID))
    expect(toast.success).toHaveBeenCalledWith("Produto excluído.")
    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent(/^\/catalogo\/produtos$/))
  })

  it("keeps the dialog open with the orders message on 409 PRODUCT_HAS_ORDERS", async () => {
    mockWizard()
    vi.mocked(deleteCatalogProduct).mockRejectedValue(new Error(i18n.t("catalog.products.view.errors.hasOrders")))
    const user = userEvent.setup()
    renderPage()
    await openMenu(user)
    await user.click(await screen.findByRole("menuitem", { name: "Excluir produto" }))
    const dialog = await screen.findByRole("dialog")
    await user.click(within(dialog).getByRole("button", { name: "Excluir" }))
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Este produto tem pedidos; desative-o em vez de excluir.")
    expect(screen.getByTestId("location")).toHaveTextContent(`/catalogo/produtos/${ID}`)
  })
})

describe("ProductViewPage history tab", () => {
  const entry = (n: number, extra: Record<string, unknown> = {}) => ({
    id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
    action: "product.updated",
    changes: [{ field: "price", old: "40.00", new: "45.00" }],
    actorName: "Ana",
    createdAt: `2026-11-${String(30 - n).padStart(2, "0")}T17:30:00.000Z`,
    ...extra,
  })

  it("renders readable sentences with the actor and falls back to Sistema", async () => {
    vi.mocked(getCatalogProductHistory).mockResolvedValue([
      entry(1),
      entry(2, { action: "product.activated", changes: [{ field: "isActive", old: "false", new: "true" }], actorName: null }),
    ] as never)
    mockWizard()
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole("tab", { name: "Histórico" }))
    const rows = await screen.findAllByTestId("product-history-entry")
    expect(rows[0]).toHaveTextContent(/^Preço alterado de R\$ 40,00 para R\$ 45,00 · Ana · \d{2}\/\d{2}[ ,]+\d{2}:\d{2}$/)
    expect(rows[1]).toHaveTextContent(/^Produto ativado · Sistema · /)
  })

  it("loads more with the createdAt + id cursor of the last entry and hides the button on the last page", async () => {
    const first = Array.from({ length: 20 }, (_, index) => entry(index + 1))
    const second = [entry(21, { changes: [{ field: "name", old: "A", new: "B" }] })]
    vi.mocked(getCatalogProductHistory).mockResolvedValueOnce(first as never).mockResolvedValueOnce(second as never)
    mockWizard()
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole("tab", { name: "Histórico" }))
    expect(await screen.findAllByTestId("product-history-entry")).toHaveLength(20)
    await user.click(screen.getByRole("button", { name: "Carregar mais" }))
    await waitFor(() => expect(screen.getAllByTestId("product-history-entry")).toHaveLength(21))
    const last = first[19]!
    expect(getCatalogProductHistory).toHaveBeenLastCalledWith(ID, { limit: 20, cursor: { before: last.createdAt, beforeId: last.id } })
    expect(screen.getByText(/Nome alterado de A para B/)).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Carregar mais" })).not.toBeInTheDocument()
  })

  it("shows the empty state", async () => {
    mockWizard()
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole("tab", { name: "Histórico" }))
    expect(await screen.findByText("Nenhuma alteração registrada.")).toBeInTheDocument()
  })
})

describe("ProductViewPage locales", () => {
  it.each([
    ["en", "Edit product", "More actions", "On request", "Price changed from R$ 40.00 to R$ 45.00"],
    ["es", "Editar producto", "Más acciones", "A consultar", "Precio cambiado de R$ 40,00 a R$ 45,00"],
  ])("renders in %s", async (lng, edit, more, onRequest, sentence) => {
    await i18n.changeLanguage(lng)
    vi.mocked(getCatalogProductHistory).mockResolvedValue([{
      id: "00000000-0000-4000-8000-000000000001",
      action: "product.updated",
      changes: [{ field: "price", old: "40.00", new: "45.00" }],
      actorName: "Ana",
      createdAt: "2026-11-12T17:30:00.000Z",
    }] as never)
    mockWizard({ product: { price: null } })
    const user = userEvent.setup()
    renderPage()
    expect(screen.getByRole("link", { name: edit })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: more })).toBeInTheDocument()
    expect(screen.getByTestId("product-view-price")).toHaveTextContent(onRequest)
    await user.click(screen.getAllByRole("tab")[2]!)
    expect(await screen.findByTestId("product-history-entry")).toHaveTextContent(sentence)
  })
})
