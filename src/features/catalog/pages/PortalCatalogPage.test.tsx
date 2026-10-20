import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { MemoryRouter, Outlet, Route, Routes } from "react-router-dom"

import { PortalCatalogPage } from "@/features/catalog/pages/PortalCatalogPage"
import { listPortalCatalogProducts } from "@/features/catalog/services/catalogPortalService"
import type { CustomerAppOutletContext } from "@/features/tenantPortal/components/CustomerAppLayout"
import i18n from "@/lib/i18n"

vi.mock("@/features/catalog/services/catalogPortalService", () => ({
  listPortalCatalogProducts: vi.fn(),
}))

const listProductsMock = vi.mocked(listPortalCatalogProducts)
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

function renderPage() {
  render(
    <MemoryRouter>
      <Routes>
        <Route element={<Outlet context={outletContext} />}>
          <Route path="/" element={<PortalCatalogPage />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe("PortalCatalogPage search", () => {
  beforeEach(() => {
    listProductsMock.mockReset()
    listProductsMock.mockResolvedValue([])
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
})
