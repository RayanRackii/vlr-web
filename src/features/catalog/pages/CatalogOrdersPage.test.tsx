import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { CatalogOrdersPage } from "@/features/catalog/pages/CatalogOrdersPage"
import type { CatalogOrder, CatalogOrderStatus } from "@/features/catalog/schemas/catalogSchemas"
import { TestPermissionProvider } from "@/features/users/permissions/PermissionContext"
import i18n from "@/lib/i18n"

vi.mock("@/features/catalog/services/catalogService", () => ({ listCatalogOrders: vi.fn() }))
import { listCatalogOrders } from "@/features/catalog/services/catalogService"

const listOrdersMock = vi.mocked(listCatalogOrders)
const ORDER: CatalogOrder = {
  id: "order-1", displayNumber: "PED-12", orderNumber: 12, status: "Requested",
  customerId: "customer-1", customerName: "Ana", customerEmail: null, customerPhone: null,
  customerNote: null, totalAmount: 15, currency: "BRL", rejectedReason: null,
  cancelledReason: null, createdAt: "2026-10-28T12:00:00Z", items: [], history: [],
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/catalogo/pedidos"]}>
      <TestPermissionProvider permissions={["catalog.orders.read"]}>
        <Routes>
          <Route path="/catalogo/pedidos" element={<CatalogOrdersPage />} />
          <Route path="/catalogo/pedidos/:id" element={<p>Order detail destination</p>} />
        </Routes>
      </TestPermissionProvider>
    </MemoryRouter>,
  )
}

describe("staff catalog orders presentation", () => {
  beforeEach(() => {
    listOrdersMock.mockReset()
    listOrdersMock.mockResolvedValue([ORDER])
  })

  it("counts the four pending stages from loaded data and keeps KPIs stable while searching", async () => {
    const statuses: CatalogOrderStatus[] = ["Requested", "Requested", "Approved", "Preparing", "Ready", "Completed", "Rejected", "Cancelled"]
    listOrdersMock.mockResolvedValue(statuses.map((status, index) => ({
      ...ORDER, id: `order-${index}`, displayNumber: `PED-${index}`, status,
    })))
    const user = userEvent.setup()
    renderPage()
    await screen.findByText("PED-0")
    const metrics = screen.getByLabelText(i18n.t("catalog.staff.orderSummary"))
    for (const [status, count] of [["Requested", "2"], ["Approved", "1"], ["Preparing", "1"], ["Ready", "1"]]) {
      const label = within(metrics).getByText(i18n.t(`catalog.staff.kpis.${status}`))
      expect(label.parentElement?.querySelector("dd")).toHaveTextContent(count)
    }
    await user.type(screen.getByRole("searchbox"), "PED-0")
    expect(screen.getByText("PED-0")).toBeInTheDocument()
    expect(screen.queryByText("PED-1")).not.toBeInTheDocument()
    expect(within(metrics).getByText(i18n.t("catalog.staff.kpis.Requested")).parentElement).toHaveTextContent("2")
    expect(listOrdersMock).toHaveBeenCalledTimes(1)
  })

  it("uses the green success chip for completed orders", async () => {
    listOrdersMock.mockResolvedValue([{ ...ORDER, status: "Completed" }])
    renderPage()
    const chip = await screen.findByText(i18n.t("catalog.status.Completed"))
    expect(chip).toHaveAttribute("data-tone", "success")
  })

  it("preserves on-request totals and opens the existing detail route", async () => {
    listOrdersMock.mockResolvedValue([{ ...ORDER, totalAmount: null, items: [
      { id: "item-1", productId: "product-1", productName: "Garrafa", productCode: null, unitPrice: 15, currency: "BRL", quantity: 1, subTotal: 15 },
      { id: "item-2", productId: "product-2", productName: "Item personalizado", productCode: null, unitPrice: null, currency: "BRL", quantity: 1, subTotal: null },
    ] }])
    const user = userEvent.setup()
    renderPage()
    expect(await screen.findByText("R$ 15,00 · Sob consulta")).toBeInTheDocument()
    expect(screen.queryByRole("link", { name: i18n.t("catalog.products.title") })).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: i18n.t("catalog.orders.view") }))
    expect(screen.getByText("Order detail destination")).toBeInTheDocument()
  })

  it("distinguishes loading, empty and error states", async () => {
    listOrdersMock.mockResolvedValue([])
    const { unmount } = renderPage()
    expect(screen.getByRole("status")).toHaveTextContent(i18n.t("catalog.staff.loading"))
    expect(await screen.findByText(i18n.t("catalog.orders.empty"))).toBeInTheDocument()
    unmount()
    listOrdersMock.mockRejectedValue(new Error("Catalog unavailable"))
    renderPage()
    expect(await screen.findByText("Catalog unavailable")).toBeInTheDocument()
    expect(within(screen.getByRole("alert")).getByText("Catalog unavailable")).toBeInTheDocument()
    expect(screen.queryByText(i18n.t("catalog.orders.empty"))).not.toBeInTheDocument()
  })
})
