import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { MemoryRouter, Outlet, Route, Routes } from "react-router-dom"

import { CATALOG_CART_MAX_QUANTITY } from "@/features/catalog/cart"
import { PortalCatalogProductPage } from "@/features/catalog/pages/PortalCatalogProductPage"
import type { PortalProduct } from "@/features/catalog/schemas/catalogSchemas"
import type { CustomerAppOutletContext } from "@/features/tenantPortal/components/CustomerAppLayout"
import i18n from "@/lib/i18n"

vi.mock("@/features/catalog/services/catalogPortalService", () => ({
  getPortalCatalogProduct: vi.fn(),
}))

import { getPortalCatalogProduct } from "@/features/catalog/services/catalogPortalService"

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
  beforeEach(() => {
    getMock.mockReset()
    getMock.mockResolvedValue(product)
  })

  it("lays the gallery and details side by side from lg and pins the add-to-cart row on mobile", async () => {
    renderPage()

    const name = await screen.findByRole("heading", { name: "Raquete" })
    const columns = name.closest("div.portal-catalog-detail-panel")?.parentElement
    expect(columns).not.toBeNull()
    expect(columns).toHaveClass("lg:grid-cols-2")

    const addToCart = screen.getByRole("button", {
      name: i18n.t("tenantPortal.catalog.addToCart"),
    })
    const stickyRow = addToCart.closest("div.portal-catalog-detail-actions")
    expect(stickyRow).not.toBeNull()
    expect(stickyRow).toHaveClass("sticky", "bottom-[calc(80px+env(safe-area-inset-bottom))]", "md:static")
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
})
