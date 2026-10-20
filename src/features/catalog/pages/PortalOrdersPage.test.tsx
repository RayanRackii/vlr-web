import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { MemoryRouter, Outlet, Route, Routes } from "react-router-dom"

import { PortalOrdersPage } from "@/features/catalog/pages/PortalOrdersPage"
import type { CatalogOrder } from "@/features/catalog/schemas/catalogSchemas"
import type { CustomerAppOutletContext } from "@/features/tenantPortal/components/CustomerAppLayout"

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

  it("shows the known sum and the on-request note in the list", async () => {
    render(
      <MemoryRouter>
        <Routes>
          <Route element={<Outlet context={outletContext} />}>
            <Route path="/" element={<PortalOrdersPage />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByText("R$ 15,00 · Sob consulta")).toBeInTheDocument()
  })
})
