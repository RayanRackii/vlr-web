import type { ReactNode } from "react"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { NotificationBell } from "@/features/notifications-inbox/components/NotificationBell"
import i18n from "@/lib/i18n"

const navigate = vi.fn()

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>()
  return { ...actual, useNavigate: () => navigate }
})

const activeModules = { value: ["catalog", "rentals"] as readonly string[] }

vi.mock("@/features/users/permissions/PermissionContext", () => ({
  useOptionalPermissions: () => ({ activeModules: activeModules.value }),
}))

vi.mock(
  "@/features/notifications-inbox/services/notificationInboxService",
  () => ({
    getNotificationSummary: vi.fn(),
    listNotifications: vi.fn(),
    markEventTypeRead: vi.fn(),
    markIdsRead: vi.fn(),
    markAllRead: vi.fn(),
  }),
)

import {
  getNotificationSummary,
  listNotifications,
  markAllRead,
  markEventTypeRead,
  markIdsRead,
} from "@/features/notifications-inbox/services/notificationInboxService"

const mockSummary = vi.mocked(getNotificationSummary)
const mockList = vi.mocked(listNotifications)
const mockMarkEventType = vi.mocked(markEventTypeRead)
const mockMarkAll = vi.mocked(markAllRead)

const SUMMARY = {
  unreadTotal: 5,
  groups: [
    {
      eventType: "catalog.order.created",
      module: "catalog",
      count: 3,
      latestAt: "2026-10-28T11:55:00.000Z",
      targetRoute: "/pedidos?status=pending",
    },
    {
      eventType: "rentals.reservation.confirmed",
      module: "rentals",
      count: 2,
      latestAt: "2026-10-28T11:50:00.000Z",
      targetRoute: "/reservas",
    },
  ],
}

function setMatchMedia(isMobile: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: isMobile,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  })
}

function renderBell(children: ReactNode = <NotificationBell />) {
  return render(<MemoryRouter>{children}</MemoryRouter>)
}

describe("NotificationBell", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("pt-BR")
    navigate.mockReset()
    activeModules.value = ["catalog", "rentals"]
    mockSummary.mockReset().mockResolvedValue(SUMMARY)
    mockList.mockReset().mockResolvedValue({ items: [], nextCursor: null })
    mockMarkEventType.mockReset().mockResolvedValue({ updated: 3 })
    mockMarkAll.mockReset().mockResolvedValue({ updated: 5 })
    vi.mocked(markIdsRead).mockReset().mockResolvedValue({ updated: 1 })
    setMatchMedia(false)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it("renders nothing when no inbox-capable module is active", () => {
    activeModules.value = ["workorders"]
    const { container } = renderBell()
    expect(container).toBeEmptyDOMElement()
    expect(mockSummary).not.toHaveBeenCalled()
  })

  it("shows the unread count and an aria-label with the count", async () => {
    renderBell()
    const button = await screen.findByRole("button", {
      name: /Notificações: 5 não lidas/,
    })
    expect(within(button).getByText("5")).toBeInTheDocument()
  })

  it("caps the badge at 99+", async () => {
    mockSummary.mockResolvedValue({
      unreadTotal: 150,
      groups: [{ ...SUMMARY.groups[0], count: 150 }],
    })
    renderBell()
    const button = await screen.findByRole("button")
    await waitFor(() =>
      expect(within(button).getByText("99+")).toBeInTheDocument(),
    )
  })

  it("renders grouped rows with pluralized labels", async () => {
    const user = userEvent.setup()
    renderBell()
    await user.click(await screen.findByRole("button"))

    expect(await screen.findByText("3 novos pedidos")).toBeInTheDocument()
    expect(
      screen.getByText("2 novas reservas confirmadas"),
    ).toBeInTheDocument()
  })

  it("uses the generic fallback label for unknown event types", async () => {
    mockSummary.mockResolvedValue({
      unreadTotal: 1,
      groups: [
        {
          eventType: "payments.invoice.paid",
          module: "catalog",
          count: 1,
          latestAt: "2026-10-28T11:55:00.000Z",
          targetRoute: "/faturas",
        },
      ],
    })
    const user = userEvent.setup()
    renderBell()
    await user.click(await screen.findByRole("button"))
    expect(
      await screen.findByText("1 notificação — payments.invoice.paid"),
    ).toBeInTheDocument()
  })

  it("marks the group read and navigates to the resolved staff route on click", async () => {
    const user = userEvent.setup()
    renderBell()
    await user.click(await screen.findByRole("button"))
    await user.click(await screen.findByText("3 novos pedidos"))

    expect(mockMarkEventType).toHaveBeenCalledWith("catalog.order.created")
    expect(navigate).toHaveBeenCalledWith("/catalogo/pedidos?status=pending")
  })

  it("marks everything read via the mark-all action", async () => {
    const user = userEvent.setup()
    renderBell()
    await user.click(await screen.findByRole("button"))
    await user.click(await screen.findByRole("button", { name: /Marcar tudo como lido/ }))
    expect(mockMarkAll).toHaveBeenCalledTimes(1)
  })

  it.each([
    ["catalog", "catalog.order.approved", "order-12", "/catalogo/pedidos/order-12"],
    ["catalog", "catalog.order.approved", null, "/catalogo/pedidos?status=approved"],
    ["rentals", "rentals.reservation.confirmed", "reservation-12", "/configuracoes/reservas?status=approved"],
  ])("opens a recent %s item using its aggregate when an order detail is available", async (module, eventType, aggregateId, expectedRoute) => {
    mockList.mockResolvedValue({
      items: [{
        id: "notification-12",
        module,
        eventType,
        aggregateId,
        title: "  Pedido #12 aprovado.  ",
        createdAt: "2026-10-28T11:55:00.000Z",
        readAt: null,
        targetRoute: "/pedidos?status=approved",
      }],
      nextCursor: null,
    })
    const user = userEvent.setup()
    renderBell()
    await user.click(await screen.findByRole("button"))
    await user.click(await screen.findByRole("button", { name: /Pedido #12 aprovado\./ }))

    expect(markIdsRead).toHaveBeenCalledWith(["notification-12"])
    expect(navigate).toHaveBeenCalledWith(expectedRoute)
  })

  it("hides groups whose module is not active", async () => {
    activeModules.value = ["catalog"]
    const user = userEvent.setup()
    renderBell()
    await user.click(await screen.findByRole("button"))

    expect(await screen.findByText("3 novos pedidos")).toBeInTheDocument()
    expect(
      screen.queryByText("2 novas reservas confirmadas"),
    ).not.toBeInTheDocument()
  })

  it("renders the empty state when there are no groups", async () => {
    mockSummary.mockResolvedValue({ unreadTotal: 0, groups: [] })
    const user = userEvent.setup()
    renderBell()
    await user.click(await screen.findByRole("button"))
    expect(
      await screen.findByText(/Nenhuma notificação nova/),
    ).toBeInTheDocument()
  })

  it("opens a dialog (bottom sheet) on mobile viewports", async () => {
    setMatchMedia(true)
    const user = userEvent.setup()
    renderBell()
    const trigger = await screen.findByRole("button")
    expect(trigger).toHaveAttribute("aria-haspopup", "dialog")
    await user.click(trigger)
    expect(await screen.findByRole("dialog")).toBeInTheDocument()
  })
})
