import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { toast } from "sonner"
import { Toaster } from "@/components/ui/sonner"
import { MemoryRouter, Outlet, Route, Routes } from "react-router-dom"

import { CATALOG_CART_MAX_QUANTITY } from "@/features/catalog/cart"
import { PortalCatalogProductPage } from "@/features/catalog/pages/PortalCatalogProductPage"
import type { PortalProduct } from "@/features/catalog/schemas/catalogSchemas"
import type { CustomerAppOutletContext } from "@/features/tenantPortal/components/CustomerAppLayout"
import i18n from "@/lib/i18n"
import { readFileSync } from "node:fs"

const portalCss = readFileSync("src/features/catalog/components/portalCatalog.css", "utf8")

vi.mock("@/features/catalog/services/catalogPortalService", () => ({
  getPortalCatalogProduct: vi.fn(),
  PortalProductUnavailableError: class PortalProductUnavailableError extends Error {},
}))

import { getPortalCatalogProduct, PortalProductUnavailableError } from "@/features/catalog/services/catalogPortalService"

const getMock = vi.mocked(getPortalCatalogProduct)

const PRODUCT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const SUBDOMAIN = "ficc"

const outletContext: CustomerAppOutletContext = {
  subdomain: SUBDOMAIN,
  branding: {
    subdomain: SUBDOMAIN,
    displayName: "FICC",
    logoSvg: null,
    primaryColor: "#123456",
    accentColor: null,
    welcomeTagline: null,
  },
  primary: "#123456",
  menu: [],
}

const product: PortalProduct = {
  id: PRODUCT_ID,
  name: "Raquete",
  code: "RAQ",
  description: "Raquete profissional",
  price: 42.5,
  currency: "BRL",
  files: [],
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={[`/t/${SUBDOMAIN}/catalogo/${PRODUCT_ID}`]}>
      <Routes>
        <Route path="/t/:subdomain" element={<Outlet context={outletContext} />}>
          <Route path="catalogo" element={<p>list-screen</p>} />
          <Route path="catalogo/:productId" element={<PortalCatalogProductPage />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe("PortalCatalogProductPage layout", () => {
  afterEach(() => vi.unstubAllGlobals())
  beforeEach(() => {
    getMock.mockReset()
    getMock.mockResolvedValue(product)
  })

  it("places add-to-cart feedback below the product Back control and above mobile navigation", async () => {
    vi.stubGlobal("matchMedia", vi.fn((media: string) => ({
      media, matches: false, onchange: null,
      addListener: vi.fn(), removeListener: vi.fn(),
      addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
    })))
    toast.dismiss()
    render(<Toaster />)
    renderPage()
    const user = userEvent.setup()
    await user.click(await screen.findByRole("button", { name: i18n.t("tenantPortal.catalog.addToCart") }))
    const feedback = await screen.findByText(i18n.t("tenantPortal.catalog.addedToCart"))
    const toaster = feedback.closest("[data-sonner-toaster]")
    expect(toaster).toHaveAttribute("data-y-position", "bottom")
    expect(toaster).toHaveStyle({ "--mobile-offset-bottom": "calc(80px + env(safe-area-inset-bottom))" })
    const back = screen.getByRole("link", { name: i18n.t("common.back") })
    back.focus()
    await user.keyboard("{Enter}")
    expect(await screen.findByText("list-screen")).toBeInTheDocument()
    toast.dismiss()
  })

  it("opens the selected product image in a modal, traps focus, and closes with Escape", async () => {
    getMock.mockResolvedValue({ ...product, files: [
      { id: "image-1", url: "https://example.test/resource.png", fileName: "resource.png", mimeType: "image/png", sizeBytes: 5 },
    ] })
    const user = userEvent.setup()
    renderPage()
    const open = await screen.findByRole("button", { name: "Ampliar imagem: Raquete" })
    await user.click(open)
    const dialog = await screen.findByRole("dialog", { name: "Raquete" })
    expect(within(dialog).getByRole("img", { name: "Raquete" })).toHaveAttribute("src", "https://example.test/resource.png")
    const close = within(dialog).getByRole("button", { name: i18n.t("common.close") })
    close.focus()
    await user.tab()
    await waitFor(() => expect(dialog).toContainElement(document.activeElement as HTMLElement))
    await user.keyboard("{Escape}")
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    expect(open).toHaveFocus()
  })

  it("reserves less vertical space on narrow screens while preserving touch targets and normal flow", async () => {
    renderPage()
    await screen.findByRole("heading", { name: product.name })
    expect(portalCss).toMatch(/@media \(max-width: 400px\)/)
    expect(portalCss).toMatch(/\.portal-catalog-detail \.portal-catalog-image\s*\{[^}]*height: 160px/)
    expect(portalCss).toMatch(/\.portal-catalog-detail-actions > button\s*\{[^}]*min-height: 44px/)
    expect(screen.getByRole("button", { name: i18n.t("tenantPortal.catalog.addToCart") }).closest(".portal-catalog-detail-actions")).not.toHaveClass("sticky", "fixed")
  })

  it("lays the gallery and details side by side from lg and keeps the actions in normal flow", async () => {
    renderPage()

    const name = await screen.findByRole("heading", { name: "Raquete" })
    const columns = name.closest("div.portal-catalog-detail-panel")?.parentElement
    expect(columns).not.toBeNull()
    expect(columns).toHaveClass("lg:grid-cols-2")

    const addToCart = screen.getByRole("button", {
      name: i18n.t("tenantPortal.catalog.addToCart"),
    })
    const actionsRow = addToCart.closest("div.portal-catalog-detail-actions")
    expect(actionsRow).not.toBeNull()
    expect(actionsRow).toHaveClass("min-w-0")
    expect(actionsRow).not.toHaveClass("sticky")
  })

  it("gives the quantity stepper buttons a 44px tap target", async () => {
    renderPage()
    await screen.findByRole("heading", { name: "Raquete" })

    expect(
      screen.getByRole("spinbutton", {
        name: i18n.t("tenantPortal.catalog.quantityFor", { name: "Raquete" }),
      }),
    ).toHaveClass("h-11")
    expect(
      screen.getByRole("button", { name: i18n.t("tenantPortal.catalog.quantityIncrease") }),
    ).toHaveClass("size-11")
    expect(
      screen.getByRole("button", { name: i18n.t("tenantPortal.catalog.quantityDecrease") }),
    ).toHaveClass("size-11")
  })

  it("steps the quantity with the -/+ buttons and clamps at the bounds", async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole("heading", { name: "Raquete" })

    const quantity = screen.getByRole("spinbutton", {
      name: i18n.t("tenantPortal.catalog.quantityFor", { name: "Raquete" }),
    })
    const decrease = screen.getByRole("button", {
      name: i18n.t("tenantPortal.catalog.quantityDecrease"),
    })
    const increase = screen.getByRole("button", {
      name: i18n.t("tenantPortal.catalog.quantityIncrease"),
    })

    expect(decrease).toBeDisabled()
    expect(quantity).toHaveValue(1)

    await user.click(increase)
    expect(quantity).toHaveValue(2)
    expect(decrease).toBeEnabled()

    await user.click(decrease)
    expect(quantity).toHaveValue(1)
    expect(decrease).toBeDisabled()

    for (let i = 1; i < CATALOG_CART_MAX_QUANTITY; i += 1) {
      await user.click(increase)
    }
    expect(quantity).toHaveValue(CATALOG_CART_MAX_QUANTITY)
    expect(increase).toBeDisabled()
  })

  it("shows a generic placeholder when the product has no images", async () => {
    renderPage()
    await screen.findByRole("heading", { name: "Raquete" })

    expect(screen.getByLabelText(i18n.t("tenantPortal.catalog.noImage"))).toBeInTheDocument()
    expect(document.querySelector("img")).toBeNull()
  })

  it("shows a friendly unavailable state for hidden or missing products", async () => {
    getMock.mockRejectedValue(new PortalProductUnavailableError("x"))
    renderPage()

    expect(await screen.findByRole("heading", { name: i18n.t("tenantPortal.catalog.unavailableTitle") })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: i18n.t("tenantPortal.catalog.backToCatalog") })).toBeInTheDocument()
    expect(screen.queryByRole("alert")).toBeNull()
  })
})
