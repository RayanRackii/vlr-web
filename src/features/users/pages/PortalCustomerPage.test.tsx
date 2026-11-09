import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { MemoryRouter, Route, Routes } from "react-router-dom"

import {
  getCatalogProductAccess,
  listCatalogOrders,
  listCatalogProducts,
  listCustomerGroups,
} from "@/features/catalog/services/catalogService"
import { PortalCustomerPage } from "@/features/users/pages/PortalCustomerPage"
import { listTenantCustomers } from "@/features/users/services/usersService"
import i18n from "@/lib/i18n"

vi.mock("@/features/catalog/services/catalogService", () => ({
  getCatalogProductAccess: vi.fn(),
  listCatalogOrders: vi.fn(),
  listCatalogProducts: vi.fn(),
  listCustomerGroups: vi.fn(),
}))

vi.mock("@/features/users/services/usersService", () => ({
  listTenantCustomers: vi.fn(),
}))

const CUSTOMER_ID = "55555555-5555-4555-8555-555555555555"

describe("PortalCustomerPage", () => {
  beforeEach(() => {
    vi.mocked(listTenantCustomers).mockResolvedValue({
      items: [{
        id: CUSTOMER_ID,
        name: "Ana Souza",
        email: "ana@example.com",
        emailVerified: true,
        createdAt: "2026-11-01T00:00:00.000Z",
      }],
      total: 1,
      page: 1,
      pageSize: 100,
    })
    vi.mocked(listCatalogOrders).mockResolvedValue([{
      id: "order-1",
      displayNumber: "PED-9",
      orderNumber: 9,
      status: "Requested",
      customerId: CUSTOMER_ID,
      customerName: "Ana Souza",
      customerEmail: null,
      customerPhone: null,
      customerNote: null,
      totalAmount: 10,
      currency: "BRL",
      rejectedReason: null,
      cancelledReason: null,
      createdAt: "2026-11-02T00:00:00.000Z",
      items: [],
      history: [],
      orderVersion: "0",
      planningRevision: 0,
      productionSummary: "NotRequired",
      estimatedReadyAt: null,
    }])
    vi.mocked(listCustomerGroups).mockResolvedValue([{
      id: "group-1",
      name: "Sócios",
      description: null,
      memberCustomerIds: [CUSTOMER_ID],
      createdAt: "2026-11-01T00:00:00.000Z",
      updatedAt: null,
    }])
    vi.mocked(listCatalogProducts).mockResolvedValue([
      { id: "public-1", name: "Suco", code: null, description: null, price: 5, currency: "BRL", isActive: true, createdAt: "2026-11-01T00:00:00.000Z", files: [], visibility: "Public" },
      { id: "shirt-1", name: "Camisa", code: null, description: null, price: 20, currency: "BRL", isActive: true, createdAt: "2026-11-01T00:00:00.000Z", files: [], visibility: "Restricted" },
    ] as never)
    vi.mocked(getCatalogProductAccess).mockResolvedValue({
      productId: "shirt-1",
      visibility: "Restricted",
      customerIds: [],
      groupIds: ["group-1"],
      restrictedWithoutGrants: false,
    })
  })

  it("joins the customer's orders, groups, and exclusive products", async () => {
    render(
      <MemoryRouter initialEntries={[`/pessoas-e-acesso/clientes/${CUSTOMER_ID}`]}>
        <Routes>
          <Route path="/pessoas-e-acesso/clientes/:id" element={<PortalCustomerPage />} />
        </Routes>
      </MemoryRouter>,
    )
    expect(await screen.findByRole("heading", { name: "Ana Souza" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /PED-9/ })).toHaveAttribute("href", "/catalogo/pedidos/order-1")
    expect(screen.getByRole("link", { name: "Sócios" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Camisa" })).toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "Suco" })).not.toBeInTheDocument()
    expect(listCatalogOrders).toHaveBeenCalledWith({ customerId: CUSTOMER_ID })
  })

  it("does not call the page a missing translation", async () => {
    expect(i18n.t("peopleAccess.customerPage.products")).toBe("Produtos exclusivos")
  })
})
