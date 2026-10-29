import { act, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createMemoryRouter, RouterProvider } from "react-router-dom"
import { ThemeProvider } from "next-themes"
import { CustomerAppLayout } from "./CustomerAppLayout"
import { clearCustomerSession, persistCustomerSession } from "../services/tenantPortalService"
import * as notifications from "../services/customerNotificationService"
import { toast } from "sonner"
import { AxiosError, AxiosHeaders } from "axios"
import i18n from "@/lib/i18n"

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

vi.mock("../services/tenantPortalService", async (importOriginal) => ({
  ...await importOriginal<typeof import("../services/tenantPortalService")>(),
  fetchTenantBranding: vi.fn(async () => ({
    subdomain: "shop", displayName: "Shop", logoSvg: null, primaryColor: "#123456",
    accentColor: null, welcomeTagline: null,
  })),
  fetchTenantMenu: vi.fn(async () => []),
}))
vi.mock("../services/customerNotificationService", () => ({
  getNotificationSummary: vi.fn(), listNotifications: vi.fn(),
  markIdsRead: vi.fn(), markAllRead: vi.fn(), markEventTypeRead: undefined,
}))

const summary = {
  unreadTotal: 2,
  groups: [{ eventType: "generic.updated", module: "future-module", count: 2,
    latestAt: "2026-10-29T12:00:00Z", targetRoute: "/t/shop/pedidos/order-1" }],
}
const item = {
  id: "notification-1", eventType: "generic.updated", module: "future-module",
  title: "Atualização disponível", createdAt: "2026-10-29T12:00:00Z",
  readAt: null, targetRoute: "/t/shop/pedidos/order-1",
}

function renderPortal() {
  const router = createMemoryRouter([
    { path: "/t/:subdomain", element: <div>Login</div> },
    { path: "/t/:subdomain/app", element: <CustomerAppLayout /> },
    { path: "/t/:subdomain/pedidos", element: <div>Orders</div> },
    { path: "/t/:subdomain/pedidos/:id", element: <div>Order details</div> },
  ], { initialEntries: ["/t/shop/app"] })
  const view = render(<ThemeProvider attribute="class"><RouterProvider router={router} /></ThemeProvider>)
  return { router, ...view }
}

beforeEach(async () => {
  vi.mocked(toast.error).mockClear()
  await i18n.changeLanguage("pt-BR")
  persistCustomerSession("customer-token", "shop", "Ana")
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" })
  Object.defineProperty(window, "matchMedia", { configurable: true, writable: true, value: (query: string) => ({
    matches: false, media: query, onchange: null,
    addEventListener: vi.fn(), removeEventListener: vi.fn(),
    addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
  }) })
  vi.mocked(notifications.getNotificationSummary).mockReset().mockResolvedValue(summary)
  vi.mocked(notifications.listNotifications).mockReset().mockResolvedValue({ items: [item], nextCursor: null })
  vi.mocked(notifications.markIdsRead).mockReset().mockResolvedValue({ updated: 1 })
  vi.mocked(notifications.markAllRead).mockReset().mockResolvedValue({ updated: 2 })
})
afterEach(() => { vi.useRealTimers(); clearCustomerSession() })

describe("customer portal notification bell", () => {
  it("shows customer counts without staff permissions or module-specific gating", async () => {
    renderPortal()
    const bell = await screen.findByRole("button", { name: "Notificações: 2 não lidas" })
    expect(within(bell).getByText("2")).toBeInTheDocument()
    expect(bell).toHaveClass("min-h-[44px]", "min-w-[44px]")
  })
})

describe("customer notification interactions", () => {
  it.each(["/t/other/app", "/\n/evil.test/x"])("keeps an unsafe item target %j inside the current tenant", async (targetRoute) => {
    vi.mocked(notifications.listNotifications).mockResolvedValue({ items: [{ ...item, targetRoute }], nextCursor: null })
    const user = userEvent.setup()
    const { router } = renderPortal()
    await user.click(await screen.findByRole("button", { name: "Notificações: 2 não lidas" }))
    await user.click(await screen.findByRole("button", { name: /Atualização disponível/ }))
    await waitFor(() => expect(router.state.location.pathname).toBe("/t/shop/pedidos"))
  })

  it.each([false, true])("marks a selected item read and follows its customer route (mobile=%s)", async (mobile) => {
    const originalMatchMedia = window.matchMedia
    window.matchMedia = (query) => ({ ...originalMatchMedia(query), matches: mobile })
    const user = userEvent.setup()
    const { router } = renderPortal()
    const bell = await screen.findByRole("button", { name: "Notificações: 2 não lidas" })
    bell.focus()
    await user.keyboard("{Enter}")
    const row = await screen.findByRole("button", { name: /Atualização disponível/ })
    expect(row).toHaveClass("min-h-11")
    if (mobile) expect(screen.getByRole("dialog")).toBeInTheDocument()
    await user.click(row)
    await waitFor(() => expect(router.state.location.pathname).toBe("/t/shop/pedidos/order-1"))
    expect(notifications.markIdsRead).toHaveBeenCalledWith(["notification-1"])
    expect(screen.getByText("Order details")).toBeInTheDocument()
  })

  it("marks everything read and refreshes the badge and open list", async () => {
    const user = userEvent.setup()
    renderPortal()
    await user.click(await screen.findByRole("button", { name: "Notificações: 2 não lidas" }))
    await screen.findByRole("button", { name: /Atualização disponível/ })
    vi.mocked(notifications.getNotificationSummary).mockResolvedValue({ unreadTotal: 0, groups: [] })
    vi.mocked(notifications.listNotifications).mockResolvedValue({ items: [], nextCursor: null })
    await user.click(screen.getByRole("button", { name: i18n.t("notifications.inbox.markAll") }))
    expect(notifications.markAllRead).toHaveBeenCalledOnce()
    await screen.findByRole("button", { name: i18n.t("notifications.inbox.ariaLabelNone") })
    await waitFor(() => expect(screen.queryByRole("button", { name: /Atualização disponível/ })).not.toBeInTheDocument())
    expect(screen.getByRole("button", { name: i18n.t("notifications.inbox.markAll") })).toBeDisabled()
  })

  it("does not navigate when marking an unowned notification returns 404", async () => {
    const user = userEvent.setup()
    const { router } = renderPortal()
    vi.mocked(notifications.markIdsRead).mockRejectedValue({ response: { status: 404 } })
    await user.click(await screen.findByRole("button", { name: "Notificações: 2 não lidas" }))
    await user.click(await screen.findByRole("button", { name: /Atualização disponível/ }))
    expect(router.state.location.pathname).toBe("/t/shop/app")
  })
})

describe("customer notification session isolation", () => {
  it("aborts and discards an old session summary when another customer signs in", async () => {
    let resolveOld!: (value: typeof summary) => void
    vi.mocked(notifications.getNotificationSummary).mockReturnValueOnce(new Promise((resolve) => { resolveOld = resolve }))
    renderPortal()
    await waitFor(() => expect(notifications.getNotificationSummary).toHaveBeenCalledOnce())
    const oldSignal = vi.mocked(notifications.getNotificationSummary).mock.calls[0][0]
    vi.mocked(notifications.getNotificationSummary).mockResolvedValue({ unreadTotal: 0, groups: [] })
    act(() => persistCustomerSession("other-customer-token", "shop", "Bob"))
    await screen.findByRole("button", { name: i18n.t("notifications.inbox.ariaLabelNone") })
    expect(oldSignal?.aborted).toBe(true)
    await act(async () => resolveOld(summary))
    expect(screen.queryByRole("button", { name: "Notificações: 2 não lidas" })).not.toBeInTheDocument()
  })

  it("closes the panel and discards a late list response on tenant change", async () => {
    let resolveList!: (value: { items: typeof item[]; nextCursor: null }) => void
    vi.mocked(notifications.listNotifications).mockReturnValueOnce(new Promise((resolve) => { resolveList = resolve }))
    const user = userEvent.setup()
    const { router } = renderPortal()
    await user.click(await screen.findByRole("button", { name: "Notificações: 2 não lidas" }))
    await waitFor(() => expect(notifications.listNotifications).toHaveBeenCalledOnce())
    const signal = vi.mocked(notifications.listNotifications).mock.calls[0][1]
    await act(async () => {
      persistCustomerSession("tenant-b-token", "other", "Bob")
      await router.navigate("/t/other/app")
    })
    expect(signal?.aborted).toBe(true)
    await act(async () => resolveList({ items: [item], nextCursor: null }))
    expect(screen.queryByRole("button", { name: /Atualização disponível/ })).not.toBeInTheDocument()
  })

  it("stops polling on logout and ignores a mark-all completion from the previous session", async () => {
    let finishMarkAll!: (value: { updated: number }) => void
    vi.mocked(notifications.markAllRead).mockReturnValueOnce(new Promise((resolve) => { finishMarkAll = resolve }))
    const user = userEvent.setup()
    renderPortal()
    await user.click(await screen.findByRole("button", { name: "Notificações: 2 não lidas" }))
    await user.click(screen.getByRole("button", { name: i18n.t("notifications.inbox.markAll") }))
    vi.useFakeTimers()
    act(() => clearCustomerSession())
    expect(screen.queryByRole("button", { name: /Notificações/ })).not.toBeInTheDocument()
    await act(async () => {
      finishMarkAll({ updated: 2 })
      await vi.advanceTimersByTimeAsync(90_000)
    })
    expect(notifications.getNotificationSummary).toHaveBeenCalledOnce()
  })

  it("polls every 30 seconds, pauses hidden tabs and refreshes when visible", async () => {
    vi.useFakeTimers()
    renderPortal()
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })
    expect(screen.getByRole("button", { name: "Notificações: 2 não lidas" })).toBeInTheDocument()
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000) })
    expect(notifications.getNotificationSummary).toHaveBeenCalledTimes(2)
    act(() => {
      Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" })
      document.dispatchEvent(new Event("visibilitychange"))
    })
    await act(async () => { await vi.advanceTimersByTimeAsync(90_000) })
    expect(notifications.getNotificationSummary).toHaveBeenCalledTimes(2)
    await act(async () => {
      Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" })
      document.dispatchEvent(new Event("visibilitychange"))
    })
    expect(notifications.getNotificationSummary).toHaveBeenCalledTimes(3)
  })
})

it.each(["pt-BR", "en", "es"])("reuses localized notification labels in %s", async (language) => {
  await i18n.changeLanguage(language)
  const user = userEvent.setup()
  renderPortal()
  await user.click(await screen.findByRole("button", { name: i18n.t("notifications.inbox.ariaLabel", { count: 2 }) }))
  expect(screen.getByRole("button", { name: i18n.t("notifications.inbox.markAll") })).toBeInTheDocument()
})

it("ignores a selected item's late completion after the session changes", async () => {
  let finishRead!: (value: { updated: number }) => void
  vi.mocked(notifications.markIdsRead).mockReturnValueOnce(new Promise((resolve) => { finishRead = resolve }))
  const user = userEvent.setup()
  const { router } = renderPortal()
  await user.click(await screen.findByRole("button", { name: "Notificações: 2 não lidas" }))
  await user.click(await screen.findByRole("button", { name: /Atualização disponível/ }))
  act(() => persistCustomerSession("other-customer-token", "shop", "Bob"))
  await act(async () => finishRead({ updated: 1 }))
  expect(router.state.location.pathname).toBe("/t/shop/app")
  expect(screen.queryByRole("button", { name: /Atualização disponível/ })).not.toBeInTheDocument()
})

it("clears the panel on a customer session change from another tab", async () => {
  const user = userEvent.setup()
  renderPortal()
  await user.click(await screen.findByRole("button", { name: "Notificações: 2 não lidas" }))
  await screen.findByRole("button", { name: /Atualização disponível/ })
  act(() => {
    window.localStorage.removeItem("rolvix.customer.token")
    window.dispatchEvent(new StorageEvent("storage", { key: "rolvix.customer.token" }))
  })
  expect(screen.queryByRole("button", { name: /Notificações/ })).not.toBeInTheDocument()
  expect(screen.queryByRole("button", { name: /Atualização disponível/ })).not.toBeInTheDocument()
})

it("requests unread notifications so older unread items remain reachable behind newer read items", async () => {
  const user = userEvent.setup()
  renderPortal()
  await user.click(await screen.findByRole("button", { name: "Notificações: 2 não lidas" }))
  await screen.findByRole("button", { name: /Atualização disponível/ })
  expect(notifications.listNotifications).toHaveBeenCalledWith(
    { limit: 20, unreadOnly: true }, expect.any(AbortSignal),
  )
})

it("discards a read completion before a delayed cross-tab storage event arrives", async () => {
  let finishRead!: (value: { updated: number }) => void
  vi.mocked(notifications.markIdsRead).mockReturnValueOnce(new Promise((resolve) => { finishRead = resolve }))
  const user = userEvent.setup()
  const { router } = renderPortal()
  await user.click(await screen.findByRole("button", { name: "Notificações: 2 não lidas" }))
  await user.click(await screen.findByRole("button", { name: /Atualização disponível/ }))
  await act(async () => {
    window.localStorage.setItem("rolvix.customer.token", "cross-tab-new-token")
    finishRead({ updated: 1 })
  })
  expect(router.state.location.pathname).toBe("/t/shop/app")
  expect(toast.error).not.toHaveBeenCalled()
})

it("shows the API error when a customer cannot mark a notification read", async () => {
  const user = userEvent.setup()
  const { router } = renderPortal()
  vi.mocked(notifications.markIdsRead).mockRejectedValue(new AxiosError("Request failed", undefined, undefined, undefined, {
    data: { error: "This notification is unavailable." }, status: 404, statusText: "Not Found",
    headers: {}, config: { headers: new AxiosHeaders() },
  }))
  await user.click(await screen.findByRole("button", { name: "Notificações: 2 não lidas" }))
  await user.click(await screen.findByRole("button", { name: /Atualização disponível/ }))
  expect(toast.error).toHaveBeenCalledWith("This notification is unavailable.")
  expect(router.state.location.pathname).toBe("/t/shop/app")
})


it.each([
  ["pt-BR", "Não foi possível carregar as notificações.", "Tentar novamente"],
  ["en", "Could not load notifications.", "Try again"],
  ["es", "No se pudieron cargar las notificaciones.", "Intentar de nuevo"],
])("recovers from a customer list failure using retry (%s)", async (language, message, retryLabel) => {
  await i18n.changeLanguage(language)
  vi.mocked(notifications.listNotifications).mockRejectedValueOnce(new Error("Unavailable"))
  const user = userEvent.setup()
  renderPortal()
  await user.click(await screen.findByRole("button", { name: i18n.t("notifications.inbox.ariaLabel", { count: 2 }) }))

  expect(await screen.findByRole("alert")).toHaveTextContent(message)
  expect(screen.queryByText(i18n.t("notifications.inbox.loading"))).not.toBeInTheDocument()
  expect(notifications.getNotificationSummary).toHaveBeenCalledOnce()

  await user.click(screen.getByRole("button", { name: retryLabel }))
  expect(await screen.findByRole("button", { name: /Atualização disponível/ })).toBeInTheDocument()
  expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  expect(notifications.listNotifications).toHaveBeenCalledTimes(2)
})
