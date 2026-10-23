import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { toast } from "sonner"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { createMemoryRouter, MemoryRouter, Outlet, Route, RouterProvider, Routes } from "react-router-dom"

import { catalogCartStorageKey } from "@/features/catalog/cart"
import { PortalCartPage } from "@/features/catalog/pages/PortalCartPage"
import type { CatalogOrder, PortalProduct } from "@/features/catalog/schemas/catalogSchemas"
import type { CustomerAppOutletContext } from "@/features/tenantPortal/components/CustomerAppLayout"
import { persistCustomerSession } from "@/features/tenantPortal/services/tenantPortalService"
import i18n from "@/lib/i18n"
import { signOutCustomerPortal } from "@/lib/sessionRestoreGuard"

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock("@/features/catalog/services/catalogPortalService", () => ({
  listPortalCatalogProducts: vi.fn(),
  createPortalCatalogOrder: vi.fn(),
}))

vi.mock("@/features/tenantPortal/services/tenantPortalService", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@/features/tenantPortal/services/tenantPortalService")
    >()
  return {
    ...actual,
    getCustomerId: () => "cust-1",
  }
})

import {
  createPortalCatalogOrder,
  listPortalCatalogProducts,
} from "@/features/catalog/services/catalogPortalService"

const listProductsMock = vi.mocked(listPortalCatalogProducts)
const createOrderMock = vi.mocked(createPortalCatalogOrder)
const toastError = vi.mocked(toast.error)

const PRODUCT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const SUBDOMAIN = "ficc"
const CUSTOMER_ID = "cust-1"

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
  description: null,
  price: 10,
  currency: "BRL",
  files: [],
}

function renderCart() {
  return render(
    <MemoryRouter>
      <Routes>
        <Route element={<Outlet context={outletContext} />}>
          <Route path="/" element={<PortalCartPage />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

function seedCart() {
  const key = catalogCartStorageKey(SUBDOMAIN, CUSTOMER_ID)
  window.sessionStorage.setItem(
    key,
    JSON.stringify([{ productId: PRODUCT_ID, quantity: 2 }]),
  )
}

function replaceValue(element: HTMLElement, value: string) {
  fireEvent.change(element, { target: { value } })
}

describe("PortalCartPage validity gate", () => {
  beforeEach(() => {
    window.sessionStorage.clear()
    listProductsMock.mockReset()
    createOrderMock.mockReset()
    vi.mocked(toast.success).mockReset()
    toastError.mockReset()
    listProductsMock.mockResolvedValue([product])
  })

  it("keeps Enviar pedido disabled until the note passes the schema and leaves Voltar and quantity free", async () => {
    seedCart()
    renderCart()

    const submit = () =>
      screen.getByRole("button", {
        name: i18n.t("tenantPortal.catalog.submitOrder"),
      })
    const back = await screen.findByRole("link", {
      name: i18n.t("common.back"),
    })
    const note = await screen.findByLabelText(
      i18n.t("tenantPortal.catalog.customerNote"),
    )
    const quantity = screen.getByRole("spinbutton", {
      name: i18n.t("tenantPortal.catalog.quantityFor", { name: "Raquete" }),
    })

    expect(submit()).toBeEnabled()
    expect(back).toBeEnabled()
    expect(quantity).toBeEnabled()
    expect(quantity).toHaveValue(2)

    replaceValue(note, "a".repeat(1001))
    expect(submit()).toBeDisabled()
    expect(back).toBeEnabled()
    expect(quantity).toBeEnabled()
    expect(createOrderMock).not.toHaveBeenCalled()

    replaceValue(note, "a".repeat(1000))
    expect(submit()).toBeEnabled()
    expect(note).toHaveAttribute("maxlength", "1000")
    expect(screen.getByText("1000/1000")).toBeInTheDocument()
    expect(back).toBeEnabled()
    expect(quantity).toHaveValue(2)

    replaceValue(quantity, "4")
    expect(quantity).toHaveValue(4)
    expect(submit()).toBeEnabled()
    expect(back).toBeEnabled()
  })

  it("hides checkout controls when the cart is empty", async () => {
    renderCart()
    expect(await screen.findByText(i18n.t("tenantPortal.catalog.cartEmpty"))).toBeInTheDocument()
    expect(screen.queryByLabelText(i18n.t("tenantPortal.catalog.customerNote"))).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: i18n.t("tenantPortal.catalog.submitOrder") })).not.toBeInTheDocument()
    expect(createOrderMock).not.toHaveBeenCalled()
  })

  it("re-enables Enviar pedido after a server error and keeps the note and items", async () => {
    seedCart()
    let rejectOrder: (reason: Error) => void = () => {
      throw new Error("missing reject")
    }
    createOrderMock.mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          rejectOrder = reject
        }),
    )
    const user = userEvent.setup()
    renderCart()

    const note = await screen.findByLabelText(
      i18n.t("tenantPortal.catalog.customerNote"),
    )
    await user.type(note, "Entregar na portaria")
    const submit = screen.getByRole("button", {
      name: i18n.t("tenantPortal.catalog.submitOrder"),
    })
    expect(submit).toBeEnabled()
    expect(screen.getByRole("link", { name: i18n.t("common.back") })).toBeEnabled()
    await user.click(submit)

    await waitFor(() => {
      expect(
        screen.getByRole("button", {
          name: i18n.t("tenantPortal.catalog.submitting"),
        }),
      ).toBeDisabled()
    })

    rejectOrder(new Error("Pedido recusado."))

    await waitFor(() => {
      expect(
        screen.getByRole("button", {
          name: i18n.t("tenantPortal.catalog.submitOrder"),
        }),
      ).toBeEnabled()
    })
    expect(toastError).toHaveBeenCalledWith("Pedido recusado.")
    expect(note).toHaveValue("Entregar na portaria")
    expect(
      screen.getByRole("spinbutton", {
        name: i18n.t("tenantPortal.catalog.quantityFor", { name: "Raquete" }),
      }),
    ).toHaveValue(2)
    expect(screen.getByRole("link", { name: i18n.t("common.back") })).toBeEnabled()
    expect(createOrderMock).toHaveBeenCalledTimes(1)
  })

  it("shows the line subtotal, a partial total, and removes only through the button", async () => {
    const unpricedId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
    listProductsMock.mockResolvedValue([
      product,
      {
        ...product,
        id: unpricedId,
        name: "Rede",
        price: null,
      },
    ])
    const key = catalogCartStorageKey(SUBDOMAIN, CUSTOMER_ID)
    window.sessionStorage.setItem(
      key,
      JSON.stringify([
        { productId: PRODUCT_ID, quantity: 2 },
        { productId: unpricedId, quantity: 1 },
      ]),
    )
    const user = userEvent.setup()
    renderCart()

    expect(await screen.findByText("Subtotal: R$ 20,00")).toBeInTheDocument()
    expect(screen.getByText("Subtotal: Sob consulta")).toBeInTheDocument()
    expect(screen.getByText("Total: A partir de R$ 20,00")).toBeInTheDocument()

    const pricedQuantity = screen.getByRole("spinbutton", {
      name: i18n.t("tenantPortal.catalog.quantityFor", { name: "Raquete" }),
    })
    replaceValue(pricedQuantity, "")
    await waitFor(() => expect(pricedQuantity).toHaveValue(null), { timeout: 5000 })
    expect(screen.getByText("Raquete")).toBeInTheDocument()
    expect(screen.getByText("Subtotal: R$ 20,00")).toBeInTheDocument()

    fireEvent.blur(pricedQuantity)
    await waitFor(() => {
      expect(pricedQuantity).toHaveValue(1)
      expect(screen.getByText("Subtotal: R$ 10,00")).toBeInTheDocument()
    }, { timeout: 5000 })

    replaceValue(pricedQuantity, "0")
    expect(pricedQuantity).toHaveValue(0)
    expect(screen.getByText("Raquete")).toBeInTheDocument()
    fireEvent.blur(pricedQuantity)
    expect(pricedQuantity).toHaveValue(1)

    replaceValue(pricedQuantity, "250")
    expect(pricedQuantity).toHaveValue(250)
    fireEvent.blur(pricedQuantity)
    expect(pricedQuantity).toHaveValue(99)

    await user.click(
      screen.getByRole("button", {
        name: i18n.t("tenantPortal.catalog.removeItem", { name: "Rede" }),
      }),
    )
    await waitFor(() => {
      expect(screen.queryByText("Rede")).not.toBeInTheDocument()
      expect(screen.getByText("Total: R$ 990,00")).toBeInTheDocument()
    }, { timeout: 5000 })
    expect(screen.queryByText(/A partir de/)).not.toBeInTheDocument()
  })

  it.each(["resolved", "rejected"] as const)("ignores a %s checkout after logout and a new login", async (outcome) => {
    seedCart()
    const storageKey = catalogCartStorageKey(SUBDOMAIN, CUSTOMER_ID)
    const originalCart = window.sessionStorage.getItem(storageKey)
    let resolveOrder: (value: CatalogOrder) => void = () => undefined
    let rejectOrder: (reason: Error) => void = () => undefined
    const pending = new Promise<CatalogOrder>((resolve, reject) => {
      resolveOrder = resolve
      rejectOrder = reject
    })
    createOrderMock.mockReturnValue(pending)
    const router = createMemoryRouter([
      {
        element: <Outlet context={outletContext} />,
        children: [{ path: "/", element: <PortalCartPage /> }],
      },
      { path: "/next-session", element: <div>next session</div> },
      { path: "/t/ficc/pedidos/:orderId", element: <div>old order</div> },
    ])
    render(<RouterProvider router={router} />)
    const user = userEvent.setup()
    await user.click(await screen.findByRole("button", {
      name: i18n.t("tenantPortal.catalog.submitOrder"),
    }))
    expect(createOrderMock).toHaveBeenCalledTimes(1)

    signOutCustomerPortal(SUBDOMAIN)
    persistCustomerSession("customer-B", SUBDOMAIN, "Bruno")
    await act(async () => { await router.navigate("/next-session") })
    await act(async () => {
      if (outcome === "resolved") {
        resolveOrder({
          id: "old-order", orderNumber: 1, displayNumber: "PED-1", status: "Requested",
          customerId: CUSTOMER_ID, customerName: "Ana", customerEmail: null, customerPhone: null,
          customerNote: null, totalAmount: 20, currency: "BRL", rejectedReason: null,
          cancelledReason: null, createdAt: "2026-10-18T12:00:00Z", items: [], history: [],
        })
      } else {
        rejectOrder(new Error("old checkout failed"))
      }
      await pending.catch(() => undefined)
    })

    expect(router.state.location.pathname).toBe("/next-session")
    expect(window.sessionStorage.getItem(storageKey)).toBe(originalCart)
    expect(toast.success).not.toHaveBeenCalled()
    expect(toastError).not.toHaveBeenCalled()
  })
})
