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
    expect(listTenantCustomers).toHaveBeenCalledWith({ page: 1, pageSize: 50 })
  })

  it("pages the directory in batches of 50 until the customer is found", async () => {
    const other = {
      id: "66666666-6666-4666-8666-666666666666",
      name: "Outra Pessoa",
      email: "outra@example.com",
      emailVerified: true,
      createdAt: "2026-11-01T00:00:00.000Z",
    }
    vi.mocked(listTenantCustomers).mockImplementation(async (query) => {
      if (query?.page === 2) {
        return {
          items: [{
            id: CUSTOMER_ID,
            name: "Ana Souza",
            email: "ana@example.com",
            emailVerified: true,
            createdAt: "2026-11-01T00:00:00.000Z",
          }],
          total: 51,
          page: 2,
          pageSize: 50,
        }
      }
      return {
        items: Array.from({ length: 50 }, (_, index) => ({ ...other, id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}` })),
        total: 51,
        page: 1,
        pageSize: 50,
      }
    })

    render(
      <MemoryRouter initialEntries={[`/pessoas-e-acesso/clientes/${CUSTOMER_ID}`]}>
        <Routes>
          <Route path="/pessoas-e-acesso/clientes/:id" element={<PortalCustomerPage />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByRole("heading", { name: "Ana Souza" })).toBeInTheDocument()
    expect(listTenantCustomers).toHaveBeenCalledWith({ page: 1, pageSize: 50 })
    expect(listTenantCustomers).toHaveBeenCalledWith({ page: 2, pageSize: 50 })
  })

  it("shows a directory failure instead of empty sections", async () => {
    vi.mocked(listTenantCustomers).mockRejectedValue(new Error("Page size must be between 1 and 50."))

    render(
      <MemoryRouter initialEntries={[`/pessoas-e-acesso/clientes/${CUSTOMER_ID}`]}>
        <Routes>
          <Route path="/pessoas-e-acesso/clientes/:id" element={<PortalCustomerPage />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByRole("alert")).toHaveTextContent("Page size must be between 1 and 50.")
    expect(screen.queryByText(i18n.t("peopleAccess.customerPage.noOrders"))).not.toBeInTheDocument()
  })

  it("shows a load error instead of empty sections", async () => {
    vi.mocked(listCatalogOrders).mockRejectedValue(new Error("Não foi possível carregar os pedidos."))

    render(
      <MemoryRouter initialEntries={[`/pessoas-e-acesso/clientes/${CUSTOMER_ID}`]}>
        <Routes>
          <Route path="/pessoas-e-acesso/clientes/:id" element={<PortalCustomerPage />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível carregar os pedidos.")
    expect(screen.queryByText(i18n.t("peopleAccess.customerPage.noOrders"))).not.toBeInTheDocument()
    expect(screen.queryByText(i18n.t("peopleAccess.customerPage.noGroups"))).not.toBeInTheDocument()
    expect(screen.queryByText(i18n.t("peopleAccess.customerPage.noProducts"))).not.toBeInTheDocument()
  })

  it("does not call the page a missing translation", async () => {
    expect(i18n.t("peopleAccess.customerPage.products")).toBe("Produtos exclusivos")
  })
})
