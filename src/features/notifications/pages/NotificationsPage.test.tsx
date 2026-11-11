import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { MemoryRouter } from "react-router-dom"

import { NotificationsPage } from "@/features/notifications/pages/NotificationsPage"
import { NotificationsSettingsPage } from "@/features/notifications/pages/NotificationsSettingsPage"
import { notificationsManifest } from "@/features/notifications/manifest"
import type { TenantNotificationChannelGroup } from "@/features/notifications/schemas/notificationChannelConfigSchemas"
import type { NotificationDelivery } from "@/features/notifications/schemas/notificationDeliverySchemas"
import {
  listNotificationChannelConfigs,
  updateNotificationChannelConfig,
} from "@/features/notifications/services/notificationChannelConfigService"
import {
  listNotificationDeliveries,
  resendNotificationDelivery,
} from "@/features/notifications/services/notificationDeliveryService"
import { TestPermissionProvider } from "@/features/users/permissions/PermissionContext"
import i18n from "@/lib/i18n"

vi.mock("@/features/notifications/services/notificationChannelConfigService", () => ({
  listNotificationChannelConfigs: vi.fn(),
  updateNotificationChannelConfig: vi.fn(),
}))
vi.mock("@/features/notifications/services/notificationDeliveryService", () => ({
  listNotificationDeliveries: vi.fn(),
  resendNotificationDelivery: vi.fn(),
}))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), message: vi.fn() } }))

const listChannels = vi.mocked(listNotificationChannelConfigs)
const updateChannel = vi.mocked(updateNotificationChannelConfig)
const listDeliveries = vi.mocked(listNotificationDeliveries)
const resendDelivery = vi.mocked(resendNotificationDelivery)

const GROUPS: TenantNotificationChannelGroup[] = [{
  module: "catalog",
  events: [{
    eventType: "catalog.order.created",
    displayKey: "catalog.events.orderCreated",
    channels: [
      { channel: "Email", isActive: true, configurable: true },
      { channel: "WhatsApp", isActive: false, configurable: true },
      { channel: "InApp", isActive: true, configurable: false },
    ],
  }],
}]

const FAILED: NotificationDelivery = {
  id: "11111111-1111-4111-8111-111111111111",
  notificationId: "22222222-2222-4222-8222-222222222222",
  eventKey: "catalog.order.created",
  module: "catalog",
  channel: "Email",
  recipientKind: "Customer",
  recipientId: null,
  recipientName: "Ana Lima",
  status: "Failed",
  attemptCount: 1,
  errorMessage: "Email recipient is missing.",
  createdAt: "2026-11-10T14:02:00.000Z",
  canResend: true,
}

const DELIVERED: NotificationDelivery = { ...FAILED, id: "33333333-3333-4333-8333-333333333333", status: "Delivered", errorMessage: null, canResend: false }

function renderPage(permissions: string[], entry = "/notificacoes") {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <TestPermissionProvider permissions={permissions}>
        <NotificationsPage />
      </TestPermissionProvider>
    </MemoryRouter>,
  )
}

describe("NotificationsPage", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("pt-BR")
    listChannels.mockReset()
    updateChannel.mockReset()
    listDeliveries.mockReset()
    resendDelivery.mockReset()
    listChannels.mockResolvedValue(structuredClone(GROUPS))
    listDeliveries.mockResolvedValue({ items: [FAILED, DELIVERED], page: 1, pageSize: 20, totalCount: 2 })
  })

  it("keeps the old settings route and gives the new page the same permission pair", () => {
    expect(notificationsManifest.routes.staff.map((route) => ({
      path: route.path, permission: route.permission, anyOf: [...(route.anyOf ?? [])],
    }))).toEqual([
      { path: "/notificacoes", permission: "core.notifications.read", anyOf: ["catalog.notifications.read"] },
      { path: "/configuracoes/notificacoes", permission: "core.notifications.read", anyOf: ["catalog.notifications.read"] },
    ])
    expect(notificationsManifest.routes.staff[0]?.element.type).toBe(NotificationsPage)
    expect(notificationsManifest.routes.staff[1]?.element.type).toBe(NotificationsSettingsPage)
    expect(notificationsManifest.navigationItems[0]?.to).toBe("/configuracoes/notificacoes")
  })

  it("renders one heading, task tabs, and a channel matrix that saves on each toggle", async () => {
    const user = userEvent.setup()
    updateChannel.mockResolvedValue({ eventType: "catalog.order.created", channel: "WhatsApp", isActive: true })
    renderPage(["core.notifications.read", "core.notifications.write"])
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1)
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(i18n.t("nav.notifications"))
    expect(screen.getByText(i18n.t("nav.sections.settings"))).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: i18n.t("notifications.page.tabs.channels") })).toHaveAttribute("aria-selected", "true")
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(screen.queryByText(/salvar alterações/i)).not.toBeInTheDocument()
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument()
    const email = await screen.findByRole("checkbox", { name: i18n.t("notifications.settings.toggleChannel", { event: i18n.t("catalog.events.orderCreated"), channel: i18n.t("catalog.channels.Email") }) })
    expect(email).toBeChecked()
    expect(screen.getByRole("checkbox", { name: /No app sempre ativo/ })).toBeDisabled()
    await user.click(screen.getByRole("checkbox", { name: i18n.t("notifications.settings.toggleChannel", { event: i18n.t("catalog.events.orderCreated"), channel: i18n.t("catalog.channels.WhatsApp") }) }))
    await waitFor(() => expect(updateChannel).toHaveBeenCalledWith({ eventType: "catalog.order.created", channel: "WhatsApp", isActive: true }))
    expect(listDeliveries).not.toHaveBeenCalled()
  })

  it("shows the empty channel state", async () => {
    listChannels.mockResolvedValue([])
    renderPage(["core.notifications.read"])
    expect(await screen.findByText(i18n.t("notifications.page.emptyChannelsTitle"))).toBeInTheDocument()
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument()
  })

  it("does not save a channel without write permission", async () => {
    renderPage(["core.notifications.read"])
    const email = await screen.findByRole("checkbox", { name: /E-mail/ })
    expect(email).toBeDisabled()
    expect(updateChannel).not.toHaveBeenCalled()
  })

  it("hides channel settings from a delivery-only reader and defaults to history", async () => {
    renderPage(["catalog.notifications.read"])
    expect(screen.queryByRole("tab", { name: i18n.t("notifications.page.tabs.channels") })).not.toBeInTheDocument()
    expect(screen.getByRole("tab", { name: i18n.t("notifications.page.tabs.history") })).toHaveAttribute("aria-selected", "true")
    expect(await screen.findAllByText("Ana Lima", { exact: false })).toHaveLength(2)
    expect(listChannels).not.toHaveBeenCalled()
  })

  it("resends only a failed delivery and keeps the status badge from stretching", async () => {
    const user = userEvent.setup()
    resendDelivery.mockResolvedValue({ ...FAILED, status: "Queued", errorMessage: null })
    renderPage(["core.notifications.read", "core.notifications.resend"], "/notificacoes?aba=historico")
    await screen.findAllByText("Ana Lima", { exact: false })
    const failed = screen.getByText(i18n.t("catalog.deliveryStatus.Failed")).closest("article")
    expect(failed).not.toBeNull()
    const badge = within(failed as HTMLElement).getByText(i18n.t("catalog.deliveryStatus.Failed"))
    expect(badge.className).toContain("notifications-badge")
    expect(badge.className).not.toMatch(/w-full|flex-1/)
    expect(screen.getAllByRole("button", { name: i18n.t("catalog.notifications.resend") })).toHaveLength(1)
    await user.click(within(failed as HTMLElement).getByRole("button", { name: i18n.t("catalog.notifications.resend") }))
    await waitFor(() => expect(resendDelivery).toHaveBeenCalledWith(FAILED.id))
  })

  it("hides resend without the resend permission and shows the empty history", async () => {
    listDeliveries.mockResolvedValue({ items: [], page: 1, pageSize: 20, totalCount: 0 })
    renderPage(["catalog.notifications.read"], "/notificacoes?aba=historico")
    expect(await screen.findByText(i18n.t("notifications.page.emptyHistoryTitle"))).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: i18n.t("catalog.notifications.resend") })).not.toBeInTheDocument()
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("denies the page when neither read permission is present", () => {
    renderPage([])
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(i18n.t("accessDenied.title"))
    expect(listChannels).not.toHaveBeenCalled()
    expect(listDeliveries).not.toHaveBeenCalled()
  })

  it("keeps the previous settings page on its own layout", () => {
    render(
      <MemoryRouter initialEntries={["/configuracoes/notificacoes"]}>
        <TestPermissionProvider permissions={["core.notifications.read"]}>
          <NotificationsSettingsPage />
        </TestPermissionProvider>
      </MemoryRouter>,
    )
    expect(document.querySelector(".notifications-page")).not.toBeInTheDocument()
    expect(document.querySelector(".max-w-7xl")).toBeInTheDocument()
  })
})
