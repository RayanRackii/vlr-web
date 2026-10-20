import { fireEvent, render, screen, waitFor } from "@testing-library/react"
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

  it.each(["impre", "dobradica", "IMPRESSORA", "Dobradiça"])(
    "delegates %s to the API and displays its results without local filtering",
    async (term) => {
      renderPage()
      await screen.findByText("Nenhum produto ativo no momento.")
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

    await screen.findByText("Nenhum produto ativo no momento.")
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
    await screen.findByText("Nenhum produto ativo no momento.")
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
