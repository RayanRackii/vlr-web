import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { MemoryRouter, Outlet, Route, Routes } from "react-router-dom"

import { PortalOrdersPage } from "@/features/catalog/pages/PortalOrdersPage"
import type { CatalogOrder } from "@/features/catalog/schemas/catalogSchemas"
import type { CustomerAppOutletContext } from "@/features/tenantPortal/components/CustomerAppLayout"
import i18n from "@/lib/i18n"

vi.mock("@/features/catalog/services/catalogPortalService", () => ({
  listPortalCatalogOrders: vi.fn(),
}))

import { listPortalCatalogOrders } from "@/features/catalog/services/catalogPortalService"

const listOrdersMock = vi.mocked(listPortalCatalogOrders)

const outletContext: CustomerAppOutletContext = {
  subdomain: "clube",
  branding: {
    subdomain: "clube",
    displayName: "Clube",
    logoSvg: null,
    primaryColor: "#123456",
    accentColor: null,
    welcomeTagline: null,
  },
  primary: "#123456",
  menu: [],
}

const mixedOrder: CatalogOrder = {
  id: "11111111-1111-4111-8111-111111111111",
  displayNumber: "PED-12",
  orderNumber: 12,
  status: "Requested",
  customerId: "22222222-2222-4222-8222-222222222222",
  customerName: "Ana",
  customerEmail: null,
  customerPhone: null,
  customerNote: null,
  totalAmount: null,
  currency: "BRL",
  rejectedReason: null,
  cancelledReason: null,
  createdAt: "2026-10-18T12:00:00.000Z",
  items: [
    {
      id: "33333333-3333-4333-8333-333333333333",
      productId: "44444444-4444-4444-8444-444444444444",
      productName: "Raquete",
      productCode: null,
      unitPrice: 15,
      currency: "BRL",
      quantity: 1,
      subTotal: 15,
    },
    {
      id: "55555555-5555-4555-8555-555555555555",
      productId: "66666666-6666-4666-8666-666666666666",
      productName: "Rede",
      productCode: null,
      unitPrice: null,
      currency: "BRL",
      quantity: 1,
      subTotal: null,
    },
  ],
  history: [],
}

describe("PortalOrdersPage", () => {
  beforeEach(() => {
    listOrdersMock.mockReset()
    listOrdersMock.mockResolvedValue([mixedOrder])
  })

  function renderList() {
    return render(
      <MemoryRouter>
        <Routes>
          <Route element={<Outlet context={outletContext} />}>
            <Route path="/" element={<PortalOrdersPage />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )
  }

  it("shows the known sum and the on-request note in the list", async () => {
    renderList()

    expect(await screen.findByText("R$ 15,00 · Sob consulta")).toBeInTheDocument()
    expect(
      screen.getByRole("link", {
        name: /PED-12\s*Solicitado\s*18\/10\/2026.*R\$ 15,00 · Sob consulta/,
      }),
    ).toBeInTheDocument()
  })

  it("shows a warning-toned status chip for a requested order", async () => {
    renderList()

    const chip = await screen.findByText("Solicitado")
    expect(chip).toHaveClass("portal-chip")
    expect(chip).toHaveClass("portal-chip-warning")
  })

  it("shows a success-toned chip for a completed order", async () => {
    listOrdersMock.mockResolvedValue([{ ...mixedOrder, status: "Completed" }])
    renderList()

    const chip = await screen.findByText("Concluído")
    expect(chip).toHaveClass("portal-chip-success")
  })

  it("shows the empty state with a catalog link when there are no orders", async () => {
    listOrdersMock.mockResolvedValue([])
    renderList()

    expect(
      await screen.findByText(i18n.t("tenantPortal.catalog.ordersEmpty")),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        i18n.t("tenantPortal.catalog.ordersEmptyDescription", {
          tenant: "Clube",
        }),
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("link", {
        name: i18n.t("tenantPortal.catalog.requestSentCatalog"),
      }),
    ).toHaveAttribute("href", "/t/clube/catalogo")
    expect(screen.getByText(i18n.t("emptyStates.examples.portalOrders"))).toBeVisible()
    expect(screen.getByRole("status")).toHaveClass("portal-empty")
    expect(screen.queryByRole("link", { name: i18n.t("emptyStates.learnMore") })).not.toBeInTheDocument()
  })
})
