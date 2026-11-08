import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { toast } from "sonner"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createMemoryRouter, MemoryRouter, Outlet, Route, RouterProvider, Routes } from "react-router-dom"

import { CATALOG_CART_MAX_QUANTITY, catalogCartStorageKey } from "@/features/catalog/cart"
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
    <main data-shell-part="main" style={{ overflowY: "auto" }}>
      <MemoryRouter>
        <Routes>
          <Route element={<Outlet context={outletContext} />}>
            <Route path="/" element={<PortalCartPage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </main>,
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
  afterEach(() => vi.unstubAllGlobals())
  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", class {
      observe = vi.fn()
      disconnect = vi.fn()
    })
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

  it("wraps line items in cards and pins the submit bar on mobile", async () => {
    seedCart()
    renderCart()

    const line = (await screen.findByText("Raquete")).closest("li")
    expect(line).not.toBeNull()
    expect(line).toHaveClass("rounded-xl", "border", "bg-card")

    const submit = screen.getByRole("button", {
      name: i18n.t("tenantPortal.catalog.submitOrder"),
    })
    const stickyBar = submit.closest("div.fixed")
    expect(stickyBar).not.toBeNull()
    expect(stickyBar).toHaveClass("fixed", "bottom-0", "md:static")
  })

  it("reserves the measured mobile footer height plus a gap so the final note can scroll clear at 360px", async () => {
    let resize = () => {}
    const disconnect = vi.fn()
    vi.stubGlobal("ResizeObserver", class {
      constructor(callback: () => void) { resize = callback }
      observe = vi.fn()
      disconnect = disconnect
    })
    let footerHeight = 156
    const measure = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(() => ({
      height: footerHeight, width: 360, x: 0, y: 0, top: 0, bottom: footerHeight, left: 0, right: 360, toJSON: () => ({}),
    }))
    try {
      seedCart()
      const { unmount } = renderCart()
      const note = await screen.findByRole("textbox", { name: i18n.t("tenantPortal.catalog.customerNote") })
      const cart = note.closest(".portal-purchase-cart")
      await waitFor(() => expect(cart).toHaveStyle({ "--cart-submit-height": "156px" }))
      expect(cart).toHaveClass("pb-[calc(var(--cart-submit-height)+1rem)]", "md:pb-0")
      footerHeight = 204
      act(() => resize())
      expect(cart).toHaveStyle({ "--cart-submit-height": "204px" })
      const user = userEvent.setup()
      await user.click(note)
      await user.keyboard("Observação{Enter}Final")
      expect(note).toHaveValue("Observação\nFinal")
      expect(note).toHaveFocus()
      unmount()
      expect(disconnect).toHaveBeenCalledOnce()
    } finally {
      measure.mockRestore()
      vi.unstubAllGlobals()
    }
  })

  it.each([
    { name: "reveals the counter clipped by 7px at 360px", footerTop: 555, position: "fixed", movement: 7 },
    { name: "leaves the fitting 393px note in place", footerTop: 667, position: "fixed", movement: 0 },
    { name: "leaves the desktop flow in place", footerTop: 555, position: "static", movement: 0 },
    { name: "reveals the focused counter after the footer grows", footerTop: 555, position: "fixed", movement: 7, trigger: "footer" },
    { name: "reveals the focused counter after the viewport resizes", footerTop: 555, position: "fixed", movement: 7, trigger: "viewport" },
  ])("$name (explicit geometry; browser validation remains required)", async ({ footerTop, position, movement, trigger }) => {
    let resizeFooter = () => {}
    vi.stubGlobal("ResizeObserver", class {
      constructor(callback: () => void) { resizeFooter = callback }
      observe = vi.fn()
      disconnect = vi.fn()
    })
    let measuredFooterTop = trigger ? 667 : footerTop
    seedCart()
    renderCart()
    const note = await screen.findByRole("textbox", { name: i18n.t("tenantPortal.catalog.customerNote") })
    const group = note.closest('[data-slot="form-item"]')!
    const main = note.closest<HTMLElement>('main[data-shell-part="main"]')!
    const footer = screen.getByRole("button", { name: i18n.t("tenantPortal.catalog.submitOrder") }).parentElement!
    footer.style.position = position
    Object.defineProperties(main, { scrollHeight: { configurable: true, value: 766 }, clientHeight: { configurable: true, value: 684 } })
    const rect = (top: number, bottom: number) => ({ top, bottom, height: bottom - top, left: 0, right: 360, width: 360, x: 0, y: top, toJSON: () => ({}) })
    const measure = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function () {
      if (this === footer) return rect(measuredFooterTop, 772)
      if (this === main) return rect(0, 684)
      if (this === note) return rect(460 - main.scrollTop, 538 - main.scrollTop)
      if (this === group) return rect(440 - main.scrollTop, 562 - main.scrollTop)
      return rect(0, 0)
    })
    const windowScroll = vi.spyOn(window, "scrollTo")
    try {
      await userEvent.setup().type(note, "Entregar aqui")
      if (trigger) {
        await act(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())))
        expect(main.scrollTop).toBe(0)
        measuredFooterTop = footerTop
        act(() => {
          if (trigger === "footer") resizeFooter()
          else window.dispatchEvent(new Event("resize"))
        })
      }
      await waitFor(() => expect(main.scrollTop).toBe(movement))
      // Flush the focus frame even in the no-movement cases.
      await act(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())))
      expect(main.scrollTop).toBe(movement)
      expect(windowScroll).not.toHaveBeenCalled()
      expect(note).toHaveFocus()
      expect(note).toHaveValue("Entregar aqui")
      act(() => note.blur())
      measuredFooterTop = 500
      act(() => window.dispatchEvent(new Event("resize")))
      await act(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())))
      expect(main.scrollTop).toBe(movement)
    } finally {
      measure.mockRestore()
      windowScroll.mockRestore()
    }
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
          name: i18n.t("tenantPortal.catalog.submitOrder"),
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
    const panel = screen.getByRole("alert")
    expect(within(panel).getByText("Pedido recusado.")).toBeInTheDocument()
    expect(within(panel).getByRole("heading", { name: "Não foi possível enviar o pedido" })).toBeInTheDocument()
    expect(panel).not.toHaveTextContent(/Pedido #|PED-\d/)
    await user.click(within(panel).getByRole("button", { name: "Tentar novamente" }))
    await waitFor(() => expect(createOrderMock).toHaveBeenCalledTimes(2))
    rejectOrder(new Error("Tente mais tarde."))
    await screen.findByText("Tente mais tarde.")
    await user.click(screen.getByRole("button", { name: "Dispensar" }))
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    expect(note).toHaveValue("Entregar na portaria")
  })

  it("navigates with one-shot confirmation state after success without a redundant toast", async () => {
    seedCart()
    createOrderMock.mockResolvedValue({
      id: "new-order", orderNumber: 12, displayNumber: "PED-12", status: "Requested",
      customerId: CUSTOMER_ID, customerName: "Ana", customerEmail: null, customerPhone: null,
      customerNote: null, totalAmount: 20, currency: "BRL", rejectedReason: null,
      cancelledReason: null, createdAt: "2026-10-18T12:00:00Z", items: [], history: [],
      orderVersion: "0", planningRevision: 0, productionSummary: "NotRequired", estimatedReadyAt: null,
    })
    const router = createMemoryRouter([
      { element: <Outlet context={outletContext} />, children: [{ path: "/", element: <PortalCartPage /> }] },
      { path: "/t/ficc/pedidos/:orderId", element: <div>order detail</div> },
    ])
    render(<RouterProvider router={router} />)
    await userEvent.setup().click(await screen.findByRole("button", { name: i18n.t("tenantPortal.catalog.submitOrder") }))
    await screen.findByText("order detail")
    expect(router.state.location.state).toEqual({ justCreated: true })
    expect(toast.success).not.toHaveBeenCalled()
    expect(window.sessionStorage.getItem(catalogCartStorageKey(SUBDOMAIN, CUSTOMER_ID))).toBeNull()
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

    const remove = screen.getByRole("button", {
      name: i18n.t("tenantPortal.catalog.removeItem", { name: "Rede" }),
    })
    expect(remove).toHaveTextContent(i18n.t("tenantPortal.catalog.remove"))
    expect(remove).not.toHaveTextContent("Rede")
    await user.click(remove)
    await waitFor(() => {
      expect(screen.queryByText("Rede")).not.toBeInTheDocument()
      expect(screen.getByText("Total: R$ 990,00")).toBeInTheDocument()
    }, { timeout: 5000 })
    expect(screen.queryByText(/A partir de/)).not.toBeInTheDocument()
  })

  it("steps the quantity with the 44px -/+ buttons and shows the unit price", async () => {
    seedCart()
    const user = userEvent.setup()
    renderCart()

    const quantity = await screen.findByRole("spinbutton", {
      name: i18n.t("tenantPortal.catalog.quantityFor", { name: "Raquete" }),
    })
    const decrease = screen.getByRole("button", {
      name: i18n.t("tenantPortal.catalog.quantityDecrease"),
    })
    const increase = screen.getByRole("button", {
      name: i18n.t("tenantPortal.catalog.quantityIncrease"),
    })
    expect(decrease).toHaveClass("size-11")
    expect(increase).toHaveClass("size-11")
    expect(
      screen.getByText(i18n.t("tenantPortal.catalog.unitPrice", { price: "R$ 10,00" })),
    ).toBeInTheDocument()

    await user.click(increase)
    expect(quantity).toHaveValue(3)
    expect(decrease).toBeEnabled()

    await user.click(decrease)
    await user.click(decrease)
    expect(quantity).toHaveValue(1)
    expect(decrease).toBeDisabled()

    replaceValue(quantity, String(CATALOG_CART_MAX_QUANTITY))
    fireEvent.blur(quantity)
    await waitFor(() => expect(increase).toBeDisabled())
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
          orderVersion: "0", planningRevision: 0, productionSummary: "NotRequired", estimatedReadyAt: null,
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
