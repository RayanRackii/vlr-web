import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { toast } from "sonner"

import { CatalogNotificationsPage } from "@/features/catalog/pages/CatalogNotificationsPage"
import {
  catalogNotificationDeliverySchema,
  formatCatalogDate,
  type CatalogNotificationDelivery,
} from "@/features/catalog/schemas/catalogSchemas"
import {
  listCatalogNotifications,
  resendCatalogNotification,
} from "@/features/catalog/services/catalogService"
import { TestPermissionProvider } from "@/features/users/permissions/PermissionContext"
import i18n from "@/lib/i18n"

vi.mock("@/features/catalog/services/catalogService", () => ({
  listCatalogNotifications: vi.fn(),
  resendCatalogNotification: vi.fn(),
}))

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

const listMock = vi.mocked(listCatalogNotifications)
const resendMock = vi.mocked(resendCatalogNotification)
const toastSuccess = vi.mocked(toast.success)
const toastError = vi.mocked(toast.error)

const failedDelivery: CatalogNotificationDelivery = {
  id: "11111111-1111-4111-8111-111111111111",
  notificationId: "22222222-2222-4222-8222-222222222222",
  eventType: "catalog.order.created",
  channel: "WhatsApp",
  recipientKind: "B2BUser",
  recipientId: null,
  recipientName: "Equipe",
  status: "Failed",
  attemptCount: 1,
  errorMessage: "WhatsApp recipient is missing.",
  createdAt: "2026-10-20T17:06:00.000Z",
}

const readAndResend = ["catalog.notifications.read", "catalog.notifications.resend"]

function renderPage(
  permissions: string[],
  deliveries: CatalogNotificationDelivery[] = [],
) {
  listMock.mockResolvedValue(deliveries)
  return render(
    <TestPermissionProvider permissions={permissions}>
      <CatalogNotificationsPage />
    </TestPermissionProvider>,
  )
}

describe("CatalogNotificationsPage", () => {
  beforeEach(() => {
    listMock.mockReset()
    resendMock.mockReset()
    toastSuccess.mockReset()
    toastError.mockReset()
    listMock.mockResolvedValue([])
  })

  it("is history-only and does not render the channel matrix", async () => {
    renderPage(["catalog.notifications.read"])

    await waitFor(() => {
      expect(listMock).toHaveBeenCalled()
    })

    expect(
      screen.getByText(i18n.t("catalog.notifications.subtitle")),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("heading", {
        name: i18n.t("catalog.notifications.title"),
      }).parentElement?.parentElement,
    ).toHaveClass("mx-auto", "w-full", "max-w-7xl")
    expect(
      screen.queryByText(i18n.t("catalog.notifications.channelsTitle")),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText(i18n.t("catalog.notifications.smsUnavailable")),
    ).not.toBeInTheDocument()
  })

  it("shows Reenviar only with catalog.notifications.resend on a failed row", async () => {
    const { unmount } = renderPage(["catalog.notifications.read"], [failedDelivery])
    expect(await screen.findByText("Equipe")).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: i18n.t("catalog.notifications.resend") }),
    ).not.toBeInTheDocument()
    unmount()

    renderPage(readAndResend, [
      failedDelivery,
      { ...failedDelivery, id: "33333333-3333-4333-8333-333333333333", status: "Sent", errorMessage: null },
    ])
    const resendButtons = await screen.findAllByRole("button", {
      name: i18n.t("catalog.notifications.resend"),
    })
    expect(resendButtons).toHaveLength(1)
  })

  it("hides Reenviar when the row says canResend is false and shows it when the field is missing", async () => {
    const { unmount } = renderPage(readAndResend, [{ ...failedDelivery, canResend: false }])
    expect(await screen.findByText("Equipe")).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: i18n.t("catalog.notifications.resend") }),
    ).not.toBeInTheDocument()
    unmount()

    renderPage(readAndResend, [failedDelivery])
    expect(
      await screen.findByRole("button", { name: i18n.t("catalog.notifications.resend") }),
    ).toBeInTheDocument()
  })

  it("toasts the returned error when the resend is still failed", async () => {
    const user = userEvent.setup()
    resendMock.mockResolvedValue({
      ...failedDelivery,
      status: "Failed",
      errorMessage: "WhatsApp recipient is missing.",
    })
    renderPage(readAndResend, [failedDelivery])

    await user.click(await screen.findByRole("button", { name: i18n.t("catalog.notifications.resend") }))

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith("WhatsApp recipient is missing.")
    })
    expect(toastSuccess).not.toHaveBeenCalled()
  })

  it.each([
    ["Sent", "catalog.notifications.toastResentSent"],
    ["Delivered", "catalog.notifications.toastResentSent"],
    ["Queued", "catalog.notifications.toastResent"],
  ] as const)("toasts success when the resend returns %s", async (status, key) => {
    const user = userEvent.setup()
    resendMock.mockResolvedValue({
      ...failedDelivery,
      status,
      errorMessage: null,
    })
    renderPage(readAndResend, [failedDelivery])

    await user.click(await screen.findByRole("button", { name: i18n.t("catalog.notifications.resend") }))

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith(i18n.t(key))
    })
    expect(toastError).not.toHaveBeenCalled()
  })

  it("disables the row button and ignores a second click while the request is in flight", async () => {
    let release: (delivery: CatalogNotificationDelivery) => void = () => {}
    resendMock.mockImplementation(() => {
      const pending = new Promise<CatalogNotificationDelivery>((resolve) => {
        release = resolve
      })
      if (resendMock.mock.calls.length === 1) {
        screen.getByRole("button", { name: i18n.t("catalog.notifications.resend") }).click()
      }
      return pending
    })
    renderPage(readAndResend, [failedDelivery])
    const button = await screen.findByRole("button", { name: i18n.t("catalog.notifications.resend") })
    button.click()

    expect(resendMock).toHaveBeenCalledTimes(1)
    await waitFor(() => {
      expect(screen.getByRole("button", { name: i18n.t("catalog.notifications.resend") })).toBeDisabled()
    })

    release({ ...failedDelivery, status: "Sent", errorMessage: null })
    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith(i18n.t("catalog.notifications.toastResentSent"))
    })
  })

  it("opens attempt history inline with the attempt, date, and error", async () => {
    const user = userEvent.setup()
    const startedAt = "2026-10-20T17:06:00.000Z"
    renderPage(readAndResend, [{
      ...failedDelivery,
      attempts: [{
        attemptNumber: 2,
        startedAt,
        finishedAt: startedAt,
        outcome: "PermanentFailure",
        errorMessage: "WhatsApp recipient is missing.",
      }],
    }])

    const toggle = await screen.findByRole("button", { name: i18n.t("catalog.notifications.attempts") })
    expect(toggle.querySelector("svg")).toBeNull()
    await user.click(toggle)

    const history = screen.getByRole("region", { name: i18n.t("catalog.notifications.attemptsTitle") })
    expect(within(history).getByText("2")).toBeInTheDocument()
    expect(within(history).getByText("WhatsApp recipient is missing.")).toBeInTheDocument()
    expect(
      within(history).getByText(formatCatalogDate(startedAt, i18n.language, "America/Sao_Paulo")),
    ).toBeInTheDocument()
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })
})

describe("catalog notification delivery schema", () => {
  const payload = {
    id: failedDelivery.id,
    notificationId: failedDelivery.notificationId,
    eventType: failedDelivery.eventType,
    channel: failedDelivery.channel,
    recipientKind: failedDelivery.recipientKind,
    recipientId: failedDelivery.recipientId,
    recipientName: failedDelivery.recipientName,
    status: failedDelivery.status,
    attemptCount: failedDelivery.attemptCount,
    errorMessage: failedDelivery.errorMessage,
    createdAt: failedDelivery.createdAt,
  }

  it("treats a missing canResend as absent and keeps a false flag", () => {
    expect(catalogNotificationDeliverySchema.parse(payload).canResend).toBeUndefined()
    expect(
      catalogNotificationDeliverySchema.parse({ ...payload, canResend: false }).canResend,
    ).toBe(false)
    expect(
      catalogNotificationDeliverySchema.parse({ ...payload, canResend: null }).canResend,
    ).toBeNull()
  })

  it("keeps valid attempts and drops a row the page cannot show", () => {
    const parsed = catalogNotificationDeliverySchema.parse({
      ...payload,
      attempts: [
        { attemptNumber: 1, startedAt: payload.createdAt, errorMessage: "missing" },
        { note: "not an attempt" },
      ],
    })
    expect(parsed.attempts).toEqual([
      {
        attemptNumber: 1,
        startedAt: payload.createdAt,
        errorMessage: "missing",
      },
    ])
  })
})
