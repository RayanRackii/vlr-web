import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { MemoryRouter, useLocation } from "react-router-dom"

import { NotificationsSettingsPage } from "@/features/notifications/pages/NotificationsSettingsPage"
import enCommon from "@/locales/en/common.json"
import esCommon from "@/locales/es/common.json"
import ptBRCommon from "@/locales/pt-BR/common.json"
import type { TenantNotificationChannelGroup } from "@/features/notifications/schemas/notificationChannelConfigSchemas"
import {
  listNotificationChannelConfigs,
  updateNotificationChannelConfig,
} from "@/features/notifications/services/notificationChannelConfigService"
import { TestPermissionProvider } from "@/features/users/permissions/PermissionContext"
import i18n from "@/lib/i18n"
import { toast } from "sonner"

vi.mock("@/features/notifications/services/notificationChannelConfigService", () => ({
  listNotificationChannelConfigs: vi.fn(),
  updateNotificationChannelConfig: vi.fn(),
}))

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

const WRITE_PERMS = [
  "core.notifications.read",
  "core.notifications.write",
] as const

const BOTH_GROUPS: TenantNotificationChannelGroup[] = [
  {
    module: "catalog",
    events: [
      {
        eventType: "catalog.order.created",
        displayKey: "catalog.events.orderCreated",
        channels: [
          { channel: "InApp", isActive: true, configurable: false },
          { channel: "Email", isActive: false, configurable: true },
          { channel: "WhatsApp", isActive: false, configurable: true },
        ],
      },
    ],
  },
  {
    module: "rentals",
    events: [
      {
        eventType: "rentals.reservation.confirmed",
        displayKey: "rentals.events.reservationConfirmed",
        channels: [
          { channel: "WhatsApp", isActive: false, configurable: true },
        ],
      },
    ],
  },
]

const listMock = vi.mocked(listNotificationChannelConfigs)
const updateMock = vi.mocked(updateNotificationChannelConfig)

function cloneGroups(
  groups: TenantNotificationChannelGroup[],
): TenantNotificationChannelGroup[] {
  return groups.map((group) => ({
    ...group,
    events: group.events.map((event) => ({
      ...event,
      channels: event.channels.map((channel) => ({ ...channel })),
    })),
  }))
}

function CurrentSearch() {
  return <output aria-label="Current search">{useLocation().search}</output>
}

function renderPage(
  permissions: readonly string[] = WRITE_PERMS,
  initialEntry = "/configuracoes/notificacoes",
) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <TestPermissionProvider permissions={permissions}>
        <NotificationsSettingsPage />
        <CurrentSearch />
      </TestPermissionProvider>
    </MemoryRouter>,
  )
}

async function waitForLoaded() {
  await waitFor(() => {
    expect(listMock).toHaveBeenCalled()
  })
  await waitFor(() => {
    expect(
      screen.getByText(i18n.t("notifications.settings.subtitle")),
    ).toBeInTheDocument()
  })
}

function eventRow(label: string) {
  const cell = screen.getByText(label)
  const row = cell.closest("tr")
  if (!row) {
    throw new Error(`Row for ${label} was not found.`)
  }
  return row
}

function toggleName(eventKey: string, channelKey: "Email" | "WhatsApp" | "InApp") {
  return i18n.t("notifications.settings.toggleChannel", {
    event: i18n.t(eventKey),
    channel: i18n.t(`catalog.channels.${channelKey}`),
  })
}

describe("NotificationsSettingsPage", () => {
  beforeEach(() => {
    listMock.mockReset()
    updateMock.mockReset()
    vi.mocked(toast.success).mockReset()
    vi.mocked(toast.error).mockReset()
    listMock.mockResolvedValue(cloneGroups(BOTH_GROUPS))
  })

  it("renders Catalog InApp as a static check and Email/WhatsApp as switches", async () => {
    renderPage()
    await waitForLoaded()

    const row = eventRow(i18n.t("catalog.events.orderCreated"))

    expect(
      within(row).queryByRole("switch", {
        name: toggleName("catalog.events.orderCreated", "InApp"),
      }),
    ).not.toBeInTheDocument()
    expect(
      within(row).getByLabelText(i18n.t("notifications.settings.inAppAlwaysOn")),
    ).toBeInTheDocument()
    expect(
      within(row).getByRole("switch", {
        name: toggleName("catalog.events.orderCreated", "Email"),
      }),
    ).toBeInTheDocument()
    expect(
      within(row).getByRole("switch", {
        name: toggleName("catalog.events.orderCreated", "WhatsApp"),
      }),
    ).toBeInTheDocument()
  })

  it("renders Rentals WhatsApp only and never SMS", async () => {
    const user = userEvent.setup()
    renderPage()
    await waitForLoaded()

    await user.click(screen.getByRole("tab", {
      name: i18n.t("notifications.settings.modules.rentals"),
    }))
    const section = screen.getByRole("tabpanel")

    expect(
      within(section).getByRole("switch", {
        name: toggleName("rentals.events.reservationConfirmed", "WhatsApp"),
      }),
    ).toBeInTheDocument()
    expect(within(section).queryByText(i18n.t("catalog.channels.Sms"))).not.toBeInTheDocument()
    expect(
      within(section).queryByRole("switch", {
        name: toggleName("rentals.events.reservationConfirmed", "Email"),
      }),
    ).not.toBeInTheDocument()
    expect(
      within(section).queryByRole("switch", {
        name: toggleName("rentals.events.reservationConfirmed", "InApp"),
      }),
    ).not.toBeInTheDocument()
  })

  it("switches module tabs, shows one table and preserves other query parameters", async () => {
    const user = userEvent.setup()
    renderPage(WRITE_PERMS, "/configuracoes/notificacoes?keep=1")
    await waitForLoaded()

    const catalogTab = screen.getByRole("tab", {
      name: i18n.t("notifications.settings.modules.catalog"),
    })
    const rentalsTab = screen.getByRole("tab", {
      name: i18n.t("notifications.settings.modules.rentals"),
    })
    expect(catalogTab).toHaveAttribute("aria-selected", "true")
    expect(screen.getAllByRole("table")).toHaveLength(1)
    expect(screen.queryByText(i18n.t("rentals.events.reservationConfirmed"))).not.toBeInTheDocument()

    await user.click(rentalsTab)
    expect(rentalsTab).toHaveAttribute("aria-selected", "true")
    expect(screen.getAllByRole("table")).toHaveLength(1)
    expect(screen.getByText(i18n.t("rentals.events.reservationConfirmed"))).toBeInTheDocument()
    expect(screen.queryByText(i18n.t("catalog.events.orderCreated"))).not.toBeInTheDocument()
    expect(screen.getByLabelText("Current search")).toHaveTextContent("?keep=1&tab=rentals")

    await user.click(catalogTab)
    expect(screen.getByText(i18n.t("catalog.events.orderCreated"))).toBeInTheDocument()
    expect(screen.getByLabelText("Current search")).toHaveTextContent("?keep=1&tab=catalog")
    expect(listMock).toHaveBeenCalledTimes(1)
    expect(updateMock).not.toHaveBeenCalled()
  })

  it("opens the module selected in the URL", async () => {
    renderPage(WRITE_PERMS, "/configuracoes/notificacoes?tab=rentals")
    await waitForLoaded()

    expect(screen.getByRole("tab", {
      name: i18n.t("notifications.settings.modules.rentals"),
    })).toHaveAttribute("aria-selected", "true")
    expect(screen.getByText(i18n.t("rentals.events.reservationConfirmed"))).toBeInTheDocument()
  })

  it("sends PUT when a configurable channel is toggled", async () => {
    const user = userEvent.setup()
    updateMock.mockResolvedValue({
      eventType: "catalog.order.created",
      channel: "Email",
      isActive: true,
    })
    renderPage()
    await waitForLoaded()

    const emailSwitch = screen.getByRole("switch", {
      name: toggleName("catalog.events.orderCreated", "Email"),
    })
    const touchTarget = emailSwitch.closest("label")
    if (!touchTarget) {
      throw new Error("The switch touch target was not rendered.")
    }
    await user.click(touchTarget)

    await waitFor(() => {
      expect(updateMock).toHaveBeenCalledWith({
        eventType: "catalog.order.created",
        channel: "Email",
        isActive: true,
      })
    })
    await waitFor(() => {
      expect(emailSwitch).toHaveAttribute("aria-checked", "true")
    })
    expect(toast.success).toHaveBeenCalledWith("Canal atualizado.")
  })

  it("restores the previous isActive and toasts the API error when PUT fails", async () => {
    const user = userEvent.setup()
    updateMock.mockRejectedValueOnce(
      new Error("Channel is not configurable for this event."),
    )
    renderPage()
    await waitForLoaded()

    const emailSwitch = screen.getByRole("switch", {
      name: toggleName("catalog.events.orderCreated", "Email"),
    })
    expect(emailSwitch).toHaveAttribute("aria-checked", "false")
    await user.click(emailSwitch)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Channel is not configurable for this event.",
      )
    })
    await waitFor(() => {
      expect(emailSwitch).toHaveAttribute("aria-checked", "false")
    })
    expect(
      screen.getByText(i18n.t("notifications.settings.subtitle")),
    ).toBeInTheDocument()
  })

  it("hides the tab bar when only Catalog is active", async () => {
    listMock.mockResolvedValue(
      cloneGroups(BOTH_GROUPS.filter((group) => group.module === "catalog")),
    )
    renderPage()
    await waitForLoaded()

    expect(screen.queryByRole("tablist")).not.toBeInTheDocument()
    expect(screen.queryByRole("tab")).not.toBeInTheDocument()
    expect(screen.getByText(i18n.t("catalog.events.orderCreated"))).toBeInTheDocument()
    expect(
      screen.queryByText(i18n.t("rentals.events.reservationConfirmed")),
    ).not.toBeInTheDocument()
  })

  it("shows the only active family even when the URL selects an inactive one", async () => {
    listMock.mockResolvedValue(cloneGroups([BOTH_GROUPS[1]]))
    renderPage(WRITE_PERMS, "/configuracoes/notificacoes?tab=catalog")
    await waitForLoaded()

    expect(screen.queryByRole("tablist")).not.toBeInTheDocument()
    expect(screen.getByText(i18n.t("rentals.events.reservationConfirmed"))).toBeInTheDocument()
    expect(screen.queryByText(i18n.t("catalog.events.orderCreated"))).not.toBeInTheDocument()
  })

  it("keeps configurable channels disabled without write permission", async () => {
    renderPage(["core.notifications.read"])
    await waitForLoaded()

    for (const channelSwitch of screen.getAllByRole("switch")) {
      expect(channelSwitch).toHaveAttribute("aria-disabled", "true")
    }
    expect(updateMock).not.toHaveBeenCalled()
  })

  it("explains that customer email starts on and mirrors the API value", async () => {
    for (const copy of [ptBRCommon, enCommon, esCommon]) {
      expect(copy.notifications.settings.emailDefault.trim().length).toBeGreaterThan(20)
    }

    listMock.mockResolvedValue([
      {
        module: "rentals",
        events: [
          {
            eventType: "rentals.reservation.confirmed",
            displayKey: "rentals.events.reservationConfirmed",
            channels: [{ channel: "Email", isActive: true, configurable: true }],
          },
        ],
      },
    ])
    const { unmount } = renderPage()
    await waitForLoaded()

    expect(
      screen.getByText(i18n.t("notifications.settings.emailDefault")),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("switch", {
        name: toggleName("rentals.events.reservationConfirmed", "Email"),
      }),
    ).toHaveAttribute("aria-checked", "true")
    unmount()

    listMock.mockResolvedValue([
      {
        module: "rentals",
        events: [
          {
            eventType: "rentals.reservation.confirmed",
            displayKey: "rentals.events.reservationConfirmed",
            channels: [{ channel: "Email", isActive: false, configurable: true }],
          },
        ],
      },
    ])
    renderPage()
    await waitForLoaded()
    expect(
      screen.getByRole("switch", {
        name: toggleName("rentals.events.reservationConfirmed", "Email"),
      }),
    ).toHaveAttribute("aria-checked", "false")
  })

  it("does not render a channel switch before the API responds", () => {
    listMock.mockReturnValue(new Promise(() => {}))
    renderPage()

    expect(screen.queryByRole("switch")).not.toBeInTheDocument()
    expect(
      screen.getByText(i18n.t("notifications.settings.emailDefault")),
    ).toBeInTheDocument()
  })
})
