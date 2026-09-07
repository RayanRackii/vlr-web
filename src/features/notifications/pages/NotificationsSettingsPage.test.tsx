import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { NotificationsSettingsPage } from "@/features/notifications/pages/NotificationsSettingsPage"
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

function renderPage(permissions: readonly string[] = WRITE_PERMS) {
  return render(
    <TestPermissionProvider permissions={permissions}>
      <NotificationsSettingsPage />
    </TestPermissionProvider>,
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
    renderPage()
    await waitForLoaded()

    const rentalsHeading = screen.getByRole("heading", {
      name: i18n.t("notifications.settings.modules.rentals"),
    })
    const section = rentalsHeading.closest("section")
    if (!section) {
      throw new Error("Rentals section was not rendered.")
    }

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
    await user.click(emailSwitch)

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

  it("omits an inactive module group when the API does not return it", async () => {
    listMock.mockResolvedValue(
      cloneGroups(BOTH_GROUPS.filter((group) => group.module === "catalog")),
    )
    renderPage()
    await waitForLoaded()

    expect(
      screen.getByRole("heading", {
        name: i18n.t("notifications.settings.modules.catalog"),
      }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("heading", {
        name: i18n.t("notifications.settings.modules.rentals"),
      }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText(i18n.t("rentals.events.reservationConfirmed")),
    ).not.toBeInTheDocument()
  })
})
