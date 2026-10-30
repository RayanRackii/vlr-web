import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { MemoryRouter, Outlet, Route, Routes } from "react-router-dom"

import { PortalCatalogPage } from "@/features/catalog/pages/PortalCatalogPage"
import { getPortalCatalogProduct, listPortalCatalogProducts } from "@/features/catalog/services/catalogPortalService"
import { getPortalCatalogTaxonomyOptions } from "@/features/taxonomy/services/taxonomyService"
import type { CustomerAppOutletContext } from "@/features/tenantPortal/components/CustomerAppLayout"
import i18n from "@/lib/i18n"

vi.mock("@/features/catalog/services/catalogPortalService", () => ({
  listPortalCatalogProducts: vi.fn(),
  getPortalCatalogProduct: vi.fn(),
}))

vi.mock("@/features/taxonomy/services/taxonomyService", () => ({
  getPortalCatalogTaxonomyOptions: vi.fn(),
}))

const listProductsMock = vi.mocked(listPortalCatalogProducts)
const getProductMock = vi.mocked(getPortalCatalogProduct)
const getTaxonomyOptionsMock = vi.mocked(getPortalCatalogTaxonomyOptions)
const outletContext: CustomerAppOutletContext = {
  subdomain: "loja",
  branding: {
    subdomain: "loja",
    displayName: "Loja",
    logoSvg: null,
    primaryColor: "#123456",
    accentColor: null,
    welcomeTagline: null,
  },
  primary: "#123456",
  menu: [],
}

function pageTree(context = outletContext, initialEntry = "/") {
  return (
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route element={<Outlet context={context} />}>
          <Route path="/" element={<PortalCatalogPage />} />
        </Route>
      </Routes>
    </MemoryRouter>
  )
}

function renderPage(context = outletContext, initialEntry = "/") {
  return render(pageTree(context, initialEntry))
}

describe("PortalCatalogPage search", () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.sessionStorage.clear()
    listProductsMock.mockReset()
    getProductMock.mockReset()
    getTaxonomyOptionsMock.mockReset()
    listProductsMock.mockResolvedValue([])
    getTaxonomyOptionsMock.mockResolvedValue({ categories: [], tags: [] })
  })

  afterEach(async () => {
    await i18n.changeLanguage("pt-BR")
  })

  it.each(["pt-BR", "en", "es"])("labels search and links the illustrated empty state to the existing request route in %s", async (language) => {
    await i18n.changeLanguage(language)
    renderPage()

    expect(await screen.findByRole("heading", { name: i18n.t("tenantPortal.catalog.empty") })).toBeInTheDocument()
    expect(screen.getByRole("textbox", { name: i18n.t("tenantPortal.catalog.searchLabel") })).toBeInTheDocument()
    expect(screen.getByText(i18n.t("tenantPortal.catalog.emptyDescription", { tenant: "Loja" }))).toBeInTheDocument()
    const requestLinks = screen.getAllByRole("link", { name: i18n.t("tenantPortal.catalog.requestCta") })
    expect(requestLinks).toHaveLength(2)
    for (const link of requestLinks) {
      expect(link).toHaveAttribute("href", "/t/loja/catalogo/solicitar")
    }
  })

  it.each([
    ["pt-BR", "/", "Catálogo 1 item", "Carrinho e ajuda"],
    ["pt-BR", "/?search=Equipamento", "Catálogo 1 resultado", "Carrinho e ajuda"],
    ["pt-BR", "/?category=11111111-1111-4111-8111-111111111111", "Catálogo 1 resultado", "Carrinho e ajuda"],
    ["pt-BR", "/?tags=11111111-1111-4111-8111-111111111111", "Catálogo 1 resultado", "Carrinho e ajuda"],
    ["en", "/?search=Equipamento", "Catalog 1 result", "Cart and help"],
    ["es", "/?search=Equipamento", "Catálogo 1 resultado", "Carrito y ayuda"],
  ])("labels the title count and sidebar in %s at %s", async (language, entry, title, sidebar) => {
    await i18n.changeLanguage(language)
    listProductsMock.mockResolvedValue([{
      id: "11111111-1111-4111-8111-111111111111",
      name: "Equipamento",
      code: null,
      description: null,
      price: 12,
      currency: "BRL",
      files: [],
    }])
    renderPage(outletContext, entry)

    await screen.findByRole("heading", { name: "Equipamento" })
    expect(screen.getByText("Loja")).toBeInTheDocument()
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(title)
    expect(screen.getByRole("complementary", { name: sidebar })).toBeInTheDocument()
  })

  it.each([
    ["pt-BR", 'Nenhum produto encontrado para "DObradiça"'],
    ["en", 'No products found for "DObradiça"'],
    ["es", 'No se encontraron productos para "DObradiça"'],
  ])("distinguishes empty search results from an empty catalog in %s", async (language, message) => {
    await i18n.changeLanguage(language)
    renderPage()

    const emptyMessage = i18n.t("tenantPortal.catalog.empty")
    expect(await screen.findByText(emptyMessage)).toBeInTheDocument()
    const input = screen.getByPlaceholderText(i18n.t("tenantPortal.catalog.searchPlaceholder"))
    fireEvent.change(input, { target: { value: "DObradiça" } })

    await waitFor(() => expect(listProductsMock).toHaveBeenLastCalledWith("DObradiça"))
    expect(await screen.findByText(message)).toBeInTheDocument()
    expect(screen.queryByText(emptyMessage)).not.toBeInTheDocument()

    fireEvent.change(input, { target: { value: "   " } })
    await waitFor(() => expect(listProductsMock).toHaveBeenLastCalledWith("   "))
    expect(await screen.findByText(emptyMessage)).toBeInTheDocument()
    expect(screen.queryByText(message)).not.toBeInTheDocument()
  })

  it.each([
    ["/?search=limpeza", "emptyStates.clearSearch"],
    ["/?category=11111111-1111-4111-8111-111111111111&search=limpeza", "emptyStates.clearFilters"],
    ["/?tags=11111111-1111-4111-8111-111111111111", "emptyStates.clearFilters"],
  ])("clears the empty catalog query at %s without showing a creation example", async (entry, labelKey) => {
    renderPage(outletContext, entry)
    await screen.findByRole("heading", { name: entry.includes("search=") ? i18n.t("tenantPortal.catalog.searchEmpty", { term: "limpeza" }) : i18n.t("emptyStates.noResults") })
    const primary = document.querySelector('[data-slot="empty-state"]') as HTMLElement
    expect(screen.queryByText(i18n.t("emptyStates.examples.portalCatalog"))).not.toBeInTheDocument()
    fireEvent.click(within(primary).getByRole("button", { name: i18n.t(labelKey) }))
    expect(await screen.findByText(i18n.t("tenantPortal.catalog.empty"))).toBeVisible()
    expect(screen.getByText(i18n.t("emptyStates.examples.portalCatalog"))).toBeVisible()
    expect(screen.getByRole("textbox", { name: i18n.t("tenantPortal.catalog.searchLabel") })).toHaveValue("")
    expect(listProductsMock).toHaveBeenLastCalledWith("")
  })

  it.each(["impre", "dobradica", "IMPRESSORA", "Dobradiça"])(
    "delegates %s to the API and displays its results without local filtering",
    async (term) => {
      renderPage()
      await screen.findByText(i18n.t("tenantPortal.catalog.empty"))
      listProductsMock.mockResolvedValue([{
        id: "11111111-1111-4111-8111-111111111111",
        name: term.toLowerCase().startsWith("impre") ? "Impressora" : "Dobradiça",
        code: null,
        description: null,
        price: null,
        currency: "BRL",
        files: [],
      }])
      fireEvent.change(screen.getByPlaceholderText("Buscar por nome ou código"), {
        target: { value: term },
      })
      const name = term.toLowerCase().startsWith("impre") ? "Impressora" : "Dobradiça"
      expect(await screen.findByText(name)).toBeInTheDocument()
      expect(listProductsMock).toHaveBeenLastCalledWith(term)
    },
  )

  it("makes a bounded number of requests when taxonomy filters are unchanged", async () => {
    renderPage()

    await waitFor(() => expect(listProductsMock).toHaveBeenCalledTimes(1))
    await new Promise((resolve) => window.setTimeout(resolve, 25))
    expect(listProductsMock).toHaveBeenCalledTimes(1)
  })

  it("clears an explicit category selection instead of preserving it", async () => {
    const category = "11111111-1111-4111-8111-111111111111"
    getTaxonomyOptionsMock.mockResolvedValue({
      categories: [{ id: category, name: "Furniture", slug: "furniture", parentId: null, icon: "folder", sortOrder: 0 }],
      tags: [],
    })
    renderPage(outletContext, `/?category=${category}`)

    fireEvent.click(await screen.findByRole("button", { name: "Limpar filtros" }))

    await waitFor(() => expect(listProductsMock).toHaveBeenLastCalledWith(""))
  })

  it("keeps the existing category and tag query semantics with the category chips", async () => {
    const category = "11111111-1111-4111-8111-111111111111"
    const tag = "22222222-2222-4222-8222-222222222222"
    getTaxonomyOptionsMock.mockResolvedValue({
      categories: [{ id: category, name: "Equipamentos", slug: "equipment", parentId: null, icon: "folder", sortOrder: 0 }],
      tags: [{ id: tag, name: "Novo", slug: "new" }],
    })
    renderPage(outletContext, `/?tags=${tag}`)

    const chip = await screen.findByRole("button", { name: "Equipamentos" })
    await waitFor(() => expect(chip).not.toBeDisabled())
    fireEvent.click(chip)
    await waitFor(() => expect(listProductsMock).toHaveBeenLastCalledWith(
      { search: "", category, tags: [tag] },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    ))
    expect(chip).toHaveAttribute("aria-pressed", "true")

    const checkbox = screen.getByRole("checkbox", { name: "Novo" })
    await waitFor(() => expect(checkbox).not.toBeDisabled())
    fireEvent.click(checkbox)
    await waitFor(() => expect(listProductsMock).toHaveBeenLastCalledWith(
      { search: "", category, tags: undefined },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    ))
    expect(checkbox).not.toBeChecked()
  })

  it("does not let an old portal identity response populate the replacement tenant", async () => {
    let resolveOld: (products: Awaited<ReturnType<typeof listPortalCatalogProducts>>) => void = () => undefined
    listProductsMock
      .mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve }))
      .mockResolvedValueOnce([])
    const view = renderPage()
    await waitFor(() => expect(listProductsMock).toHaveBeenCalledTimes(1))

    const replacement = { ...outletContext, subdomain: "other", branding: { ...outletContext.branding, subdomain: "other" } }
    view.rerender(pageTree(replacement))
    await waitFor(() => expect(listProductsMock).toHaveBeenCalledTimes(2))

    resolveOld([{
      id: "11111111-1111-4111-8111-111111111111",
      name: "Old tenant product",
      code: null,
      description: null,
      price: 12,
      currency: "BRL",
      files: [],
    }])

    await screen.findByText(i18n.t("tenantPortal.catalog.empty"))
    expect(screen.queryByText("Old tenant product")).not.toBeInTheDocument()
  })

  it("keeps an unresolved cart product explicit and offers a retry", async () => {
    window.localStorage.setItem("rolvix.customer.id", "customer")
    window.sessionStorage.setItem(
      "rolvix.catalog.cart.loja.customer",
      JSON.stringify([{ productId: "11111111-1111-4111-8111-111111111111", quantity: 1 }]),
    )
    getProductMock.mockRejectedValue(new Error("network"))
    renderPage()

    expect(await screen.findByText("Não foi possível carregar este produto.")).toBeInTheDocument()
    expect(screen.queryByText("Sob consulta")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }))
    await waitFor(() => expect(getProductMock).toHaveBeenCalledTimes(2))
  })

  it("keeps a hidden cart detail request alive when the catalog list changes", async () => {
    const productId = "11111111-1111-4111-8111-111111111111"
    window.localStorage.setItem("rolvix.customer.id", "customer")
    window.sessionStorage.setItem(
      "rolvix.catalog.cart.loja.customer",
      JSON.stringify([{ productId, quantity: 1 }]),
    )

    let resolveList: (products: Awaited<ReturnType<typeof listPortalCatalogProducts>>) => void = () => undefined
    let resolveDetail: (product: Awaited<ReturnType<typeof getPortalCatalogProduct>>) => void = () => undefined
    let detailSignal: AbortSignal | undefined
    listProductsMock.mockImplementationOnce(() => new Promise((resolve) => { resolveList = resolve }))
    getProductMock.mockImplementation((_id, options) => {
      detailSignal = options?.signal
      return new Promise((resolve) => { resolveDetail = resolve })
    })

    renderPage()
    await waitFor(() => expect(getProductMock).toHaveBeenCalledWith(productId, expect.anything()))

    resolveList([])
    await screen.findByText(i18n.t("tenantPortal.catalog.empty"))
    expect(detailSignal?.aborted).toBe(false)

    resolveDetail({
      id: productId,
      name: "Produto oculto",
      code: null,
      description: null,
      price: 12,
      currency: "BRL",
      files: [],
    })

    expect(await screen.findByText("Produto oculto")).toBeInTheDocument()
  })
})
