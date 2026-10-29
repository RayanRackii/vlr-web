import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { StrictMode } from "react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { createMemoryRouter, Outlet, RouterProvider } from "react-router-dom"

import { PortalOrderDetailPage } from "@/features/catalog/pages/PortalOrderDetailPage"
import type { CatalogOrder } from "@/features/catalog/schemas/catalogSchemas"
import type { CustomerAppOutletContext } from "@/features/tenantPortal/components/CustomerAppLayout"
import i18n from "@/lib/i18n"

vi.mock("@/features/catalog/services/catalogPortalService", () => ({
  getPortalCatalogOrder: vi.fn(),
  getPortalCatalogPolicy: vi.fn(),
  cancelPortalCatalogOrder: vi.fn(),
}))

import {
  cancelPortalCatalogOrder,
  getPortalCatalogPolicy,
  getPortalCatalogOrder,
} from "@/features/catalog/services/catalogPortalService"

const getOrderMock = vi.mocked(getPortalCatalogOrder)
const cancelOrderMock = vi.mocked(cancelPortalCatalogOrder)

const ORDER_ID = "11111111-1111-4111-8111-111111111111"

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

function mixedOrder(status: CatalogOrder["status"] = "Requested"): CatalogOrder {
  return {
    id: ORDER_ID,
    displayNumber: "PED-12",
    orderNumber: 12,
    status,
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
        unitPrice: 10,
        currency: "BRL",
        quantity: 2,
        subTotal: 20,
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
}

function renderDetail(state: Record<string, unknown> | null = null) {
  const router = createMemoryRouter([
    { element: <Outlet context={outletContext} />, children: [
      { path: "/pedidos/:orderId", element: <PortalOrderDetailPage /> },
    ] },
  ], { initialEntries: [{ pathname: `/pedidos/${ORDER_ID}`, state }] })
  return { ...render(<StrictMode><RouterProvider router={router} /></StrictMode>), router }
}

describe("PortalOrderDetailPage", () => {
  beforeEach(() => {
    vi.mocked(getPortalCatalogPolicy).mockResolvedValue({ canCancelOrders: true, canCancelRequests: false, upToStatus: { orders: "Requested", requests: "Submitted" }, policyText: null })
    getOrderMock.mockReset()
    cancelOrderMock.mockReset()
    getOrderMock.mockResolvedValue(mixedOrder())
  })

  it("shows a success hero once, consumes only its state with replace, and does not replay on remount", async () => {
    const { router, unmount } = renderDetail({ justCreated: true, keep: "context" })
    expect(await screen.findByRole("heading", { name: "Pedido recebido" })).toBeInTheDocument()
    expect(screen.getByText("Pedido #12")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Continuar comprando" })).toHaveAttribute("href", "/t/clube/catalogo")
    await waitFor(() => expect(router.state.location.state).toEqual({ keep: "context" }))
    expect(router.state.historyAction).toBe("REPLACE")
    await userEvent.setup().click(screen.getByRole("button", { name: "Acompanhar pedido" }))
    expect(screen.getByRole("region", { name: "Acompanhamento" })).toHaveFocus()
    unmount()
    render(<RouterProvider router={router} />)
    await screen.findByText("PED-12")
    expect(screen.queryByRole("heading", { name: "Pedido recebido" })).not.toBeInTheDocument()
    await act(async () => { await router.navigate("/pedidos/other") })
    expect(screen.queryByRole("heading", { name: "Pedido recebido" })).not.toBeInTheDocument()
  })

  it.each([
    ["Requested", "Recebido"], ["Approved", "Confirmado"], ["Preparing", "Em preparo"],
    ["Ready", "Pronto"], ["Completed", "Concluído"],
  ] as const)("maps %s to the real tracking step without inventing timestamps", async (status, label) => {
    getOrderMock.mockResolvedValue(mixedOrder(status))
    renderDetail()
    const tracking = await screen.findByRole("region", { name: "Acompanhamento" })
    expect(within(tracking).getAllByRole("listitem")).toHaveLength(5)
    const step = within(tracking).getByText(label).closest("li")
    if (status === "Completed") {
      expect(tracking.querySelector('[aria-current="step"]')).toBeNull()
      expect(step).toHaveClass("is-done")
    } else {
      expect(step).toHaveAttribute("aria-current", "step")
    }
    expect(within(tracking).getAllByRole("time")).toHaveLength(1)
    expect(screen.queryByRole("heading", { name: "Pedido recebido" })).not.toBeInTheDocument()
  })

  it.each(["Cancelled", "Rejected"] as const)("shows %s as a terminal state and preserves the history reason", async (status) => {
    const order = mixedOrder(status)
    order.history = [{ id: "history-1", status, actorType: "System", actorId: null,
      reason: "Item indisponível", createdAt: "2026-10-18T13:00:00Z" }]
    getOrderMock.mockResolvedValue(order)
    renderDetail()
    const tracking = await screen.findByRole("region", { name: "Acompanhamento" })
    expect(within(tracking).queryByText("Concluído")).not.toBeInTheDocument()
    expect(within(within(tracking).getByRole("list", { name: "Acompanhamento" })).getAllByRole("listitem")).toHaveLength(2)
    expect(within(tracking).getByText(status === "Cancelled" ? "Pedido cancelado" : "Pedido recusado").closest("li")).toHaveClass("is-terminal")
    await userEvent.setup().click(screen.getByText(i18n.t("catalog.orders.timeline")))
    expect(screen.getByText("Item indisponível")).toBeVisible()
  })

  it("shows the known sum plus the on-request note for a mixed order", async () => {
    renderDetail()

    expect(await screen.findByText("R$ 20,00 · Sob consulta")).toBeInTheDocument()
    expect(screen.getByText("Sob consulta")).toBeInTheDocument()
    expect(screen.getByText("R$ 20,00")).toBeInTheDocument()
  })

  it("asks before cancelling and leaves the order unchanged when dismissed", async () => {
    const user = userEvent.setup()
    renderDetail()

    await user.click(
      await screen.findByRole("button", {
        name: i18n.t("tenantPortal.catalog.cancelOrder"),
      }),
    )
    expect(
      await screen.findByRole("heading", {
        name: i18n.t("tenantPortal.catalog.cancelConfirmTitle"),
      }),
    ).toBeInTheDocument()
    expect(cancelOrderMock).not.toHaveBeenCalled()

    await user.click(
      screen.getByRole("button", {
        name: i18n.t("tenantPortal.catalog.cancelConfirmDismiss"),
      }),
    )

    await waitFor(() => {
      expect(
        screen.queryByRole("heading", {
          name: i18n.t("tenantPortal.catalog.cancelConfirmTitle"),
        }),
      ).not.toBeInTheDocument()
    })
    expect(cancelOrderMock).not.toHaveBeenCalled()
    expect(screen.getByText("Solicitado")).toBeInTheDocument()
  })

  it("cancels only after confirmation", async () => {
    const user = userEvent.setup()
    cancelOrderMock.mockResolvedValue(mixedOrder("Cancelled"))
    renderDetail()

    await user.click(
      await screen.findByRole("button", {
        name: i18n.t("tenantPortal.catalog.cancelOrder"),
      }),
    )
    await user.click(
      await screen.findByRole("button", {
        name: i18n.t("tenantPortal.catalog.cancelConfirmAction"),
      }),
    )

    await waitFor(() => {
      expect(cancelOrderMock).toHaveBeenCalledWith(ORDER_ID)
    })
    expect(await screen.findByText("Cancelado")).toBeInTheDocument()
    expect(
      screen.queryByRole("button", {
        name: i18n.t("tenantPortal.catalog.cancelOrder"),
      }),
    ).not.toBeInTheDocument()
  })

  it("ignores a second confirm click while cancel is in flight", async () => {
    const user = userEvent.setup()
    let resolveCancel: (order: CatalogOrder) => void = () => {
      throw new Error("missing resolve")
    }
    cancelOrderMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCancel = resolve
        }),
    )
    renderDetail()

    await user.click(
      await screen.findByRole("button", {
        name: i18n.t("tenantPortal.catalog.cancelOrder"),
      }),
    )
    const confirm = await screen.findByRole("button", {
      name: i18n.t("tenantPortal.catalog.cancelConfirmAction"),
    })
    fireEvent.click(confirm)
    fireEvent.click(confirm)

    expect(cancelOrderMock).toHaveBeenCalledTimes(1)
    resolveCancel(mixedOrder("Cancelled"))
    expect(await screen.findByText("Cancelado")).toBeInTheDocument()
  })
})
