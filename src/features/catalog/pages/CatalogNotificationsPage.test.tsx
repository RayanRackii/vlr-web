import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { toast } from "sonner"

import { CatalogNotificationsPage } from "@/features/catalog/pages/CatalogNotificationsPage"
import {
  catalogNotificationDeliveryListSchema,
  catalogNotificationDeliverySchema,
  formatCatalogDate,
} from "@/features/catalog/schemas/catalogSchemas"
import {
  listNotificationDeliveries,
  resendNotificationDelivery,
} from "@/features/notifications/services/notificationDeliveryService"
import type { NotificationDelivery } from "@/features/notifications/schemas/notificationDeliverySchemas"
import { TestPermissionProvider } from "@/features/users/permissions/PermissionContext"
import i18n from "@/lib/i18n"

vi.mock("@/features/notifications/services/notificationDeliveryService", () => ({
  listNotificationDeliveries: vi.fn(),
  resendNotificationDelivery: vi.fn(),
}))

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    message: vi.fn(),
  },
}))

const listMock = vi.mocked(listNotificationDeliveries)
const resendMock = vi.mocked(resendNotificationDelivery)
const toastSuccess = vi.mocked(toast.success)
const toastError = vi.mocked(toast.error)
const toastMessage = vi.mocked(toast.message)

const failedDelivery: NotificationDelivery = {
  id: "11111111-1111-4111-8111-111111111111",
  notificationId: "22222222-2222-4222-8222-222222222222",
  eventKey: "catalog.order.created",
  module: "catalog",
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
  deliveries: NotificationDelivery[] = [],
) {
  listMock.mockResolvedValue({
    items: deliveries,
    page: 1,
    pageSize: 20,
    totalCount: deliveries.length,
  })
  return render(
    <TestPermissionProvider permissions={permissions}>
      <CatalogNotificationsPage />
    </TestPermissionProvider>,
  )
}

describe("CatalogNotificationsPage", () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
    listMock.mockReset()
    resendMock.mockReset()
    toastSuccess.mockReset()
    toastError.mockReset()
    toastMessage.mockReset()
    listMock.mockResolvedValue({ items: [], page: 1, pageSize: 20, totalCount: 0 })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
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
    expect(screen.getByRole("table")).toBeInTheDocument()
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

  it("hides Reenviar for Sending and for canResend false", async () => {
    renderPage(readAndResend, [
      { ...failedDelivery, status: "Sending", errorMessage: null },
      {
        ...failedDelivery,
        id: "33333333-3333-4333-8333-333333333333",
        canResend: false,
      },
    ])

    expect(await screen.findByText(i18n.t("catalog.deliveryStatus.Sending"))).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: i18n.t("catalog.notifications.resend") }),
    ).not.toBeInTheDocument()
  })

  it("shows Reenviar when canResend is missing", async () => {
    renderPage(readAndResend, [failedDelivery])
    expect(
      await screen.findByRole("button", { name: i18n.t("catalog.notifications.resend") }),
    ).toBeInTheDocument()
  })

  it("does not toast an error when the resend is still sending", async () => {
    const user = userEvent.setup()
    resendMock.mockResolvedValue({
      ...failedDelivery,
      status: "Sending",
      errorMessage: "still working",
    })
    renderPage(readAndResend, [failedDelivery])

    await user.click(await screen.findByRole("button", { name: i18n.t("catalog.notifications.resend") }))

    await waitFor(() => {
      expect(toastMessage).toHaveBeenCalledWith(i18n.t("catalog.notifications.toastResendSending"))
    })
    expect(toastError).not.toHaveBeenCalled()
    expect(toastSuccess).not.toHaveBeenCalled()
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
      expect(toastError).toHaveBeenCalledWith(i18n.t("catalog.notifications.errors.whatsappMissing"))
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
    let release: (delivery: NotificationDelivery) => void = () => {}
    resendMock.mockImplementation(() => {
      const pending = new Promise<NotificationDelivery>((resolve) => {
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

  it("renders the API attempt list and, without it, only the count", async () => {
    const user = userEvent.setup()
    const startedAt = "2026-10-20T17:40:00.000Z"
    const finishedAt = "2026-10-20T18:40:00.000Z"
    const { unmount } = renderPage(readAndResend, [{
      ...failedDelivery,
      attempts: [{
        attemptNumber: 2,
        startedAt,
        finishedAt,
        outcome: "PermanentFailure",
        errorMessage: "WhatsApp recipient is missing.",
        channel: "WhatsApp",
      }, {
        attemptNumber: 1,
        startedAt,
        finishedAt: null,
        outcome: "TransientFailure",
        errorMessage: null,
        channel: "Email",
      }],
    }])

    const toggle = await screen.findByRole("button", { name: i18n.t("catalog.notifications.attempts") })
    expect(toggle.querySelector("svg")).toBeNull()
    await user.click(toggle)

    const history = screen.getByRole("region", { name: i18n.t("catalog.notifications.attemptsTitle") })
    expect(within(history).getByText("2")).toBeInTheDocument()
    expect(within(history).getByText(i18n.t("catalog.notifications.errors.whatsappMissing"))).toBeInTheDocument()
    expect(within(history).getByText(i18n.t("catalog.channels.WhatsApp"))).toBeInTheDocument()
    expect(within(history).getByText(i18n.t("catalog.notifications.attemptOutcome.PermanentFailure"))).toBeInTheDocument()
    expect(within(history).getByText(i18n.t("catalog.notifications.attemptOutcome.TransientFailure"))).toBeInTheDocument()
    expect(
      within(history).getByText(formatCatalogDate(finishedAt, i18n.language, "America/Sao_Paulo")),
    ).toBeInTheDocument()
    expect(
      within(history).getByText(formatCatalogDate(startedAt, i18n.language, "America/Sao_Paulo")),
    ).toBeInTheDocument()
    expect(
      within(history).queryByText(formatCatalogDate(failedDelivery.createdAt, i18n.language, "America/Sao_Paulo")),
    ).not.toBeInTheDocument()
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    unmount()

    renderPage(readAndResend, [failedDelivery])
    await user.click(await screen.findByRole("button", { name: i18n.t("catalog.notifications.attempts") }))
    const countOnly = screen.getByRole("region", { name: i18n.t("catalog.notifications.attemptsTitle") })
    expect(within(countOnly).getByText(i18n.t("catalog.notifications.attemptCount", { count: failedDelivery.attemptCount }))).toBeInTheDocument()
    expect(
      within(countOnly).queryByText(formatCatalogDate(failedDelivery.createdAt, i18n.language, "America/Sao_Paulo")),
    ).not.toBeInTheDocument()
    expect(within(countOnly).queryByText("WhatsApp recipient is missing.")).not.toBeInTheDocument()
  })

  it("shows each delivery as a card below the md breakpoint", async () => {
    const user = userEvent.setup()
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query === "(max-width: 767px)",
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
    const startedAt = "2026-10-20T17:40:00.000Z"
    const finishedAt = "2026-10-20T18:40:00.000Z"
    renderPage(readAndResend, [{
      ...failedDelivery,
      attempts: [{
        attemptNumber: 1,
        startedAt,
        finishedAt,
        outcome: "PermanentFailure",
        errorMessage: "WhatsApp recipient is missing.",
        channel: "WhatsApp",
      }],
    }])

    expect(screen.queryByRole("table")).not.toBeInTheDocument()
    const card = await screen.findByRole("article", { name: i18n.t("catalog.events.orderCreated") })
    expect(card).not.toHaveClass("overflow-x-auto")
    expect(card).toHaveTextContent(i18n.t("catalog.channels.WhatsApp"))
    expect(card).toHaveTextContent("Equipe")
    expect(within(card).getByText(i18n.t("catalog.deliveryStatus.Failed"))).toBeInTheDocument()
    expect(within(card).getByText(i18n.t("catalog.notifications.errors.whatsappMissing"))).toBeInTheDocument()
    expect(within(card).getByText(formatCatalogDate(failedDelivery.createdAt, i18n.language, "America/Sao_Paulo"))).toBeInTheDocument()
    const attempts = within(card).getByRole("button", { name: i18n.t("catalog.notifications.attempts") })
    expect(attempts.querySelector("svg")).toBeNull()
    expect(within(card).getByRole("button", { name: i18n.t("catalog.notifications.resend") })).toBeInTheDocument()

    await user.click(attempts)
    const history = within(card).getByRole("region", { name: i18n.t("catalog.notifications.attemptsTitle") })
    expect(within(history).getByText(i18n.t("catalog.notifications.errors.whatsappMissing"))).toBeInTheDocument()
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("loads a page from the server and asks for the next one", async () => {
    const user = userEvent.setup()
    listMock.mockResolvedValue({
      items: [failedDelivery],
      page: 1,
      pageSize: 20,
      totalCount: 40,
    })
    render(
      <TestPermissionProvider permissions={readAndResend}>
        <CatalogNotificationsPage />
      </TestPermissionProvider>,
    )

    expect(await screen.findByText("Equipe")).toBeInTheDocument()
    expect(listMock).toHaveBeenCalledWith(expect.objectContaining({ page: 1, pageSize: 20 }))
    await user.click(screen.getByRole("button", { name: i18n.t("peopleAccess.pagination.next") }))
    await waitFor(() => {
      expect(listMock).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2, pageSize: 20 }))
    })
  })

  it("sends status, channel, event, and dates to the server", async () => {
    const user = userEvent.setup()
    renderPage(readAndResend, [failedDelivery])
    expect(await screen.findByText("Equipe")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: i18n.t("catalog.deliveryStatus.Failed") }))
    await waitFor(() => {
      expect(listMock).toHaveBeenLastCalledWith(expect.objectContaining({
        status: "Failed",
        page: 1,
        pageSize: 20,
      }))
    })

    await user.click(screen.getByRole("button", { name: i18n.t("catalog.channels.Email") }))
    await waitFor(() => {
      expect(listMock).toHaveBeenLastCalledWith(expect.objectContaining({ channel: "Email", page: 1 }))
    })

    await user.click(screen.getByRole("button", { name: i18n.t("catalog.events.orderCreated") }))
    await waitFor(() => {
      expect(listMock).toHaveBeenLastCalledWith(expect.objectContaining({
        event: "catalog.order.created",
        page: 1,
      }))
    })

    fireEvent.change(screen.getByLabelText(i18n.t("catalog.notifications.filters.from")), {
      target: { value: "2026-10-01" },
    })
    await waitFor(() => {
      expect(listMock).toHaveBeenLastCalledWith(expect.objectContaining({
        from: new Date("2026-10-01T00:00:00").toISOString(),
        page: 1,
      }))
    })
  })

  it("shows the log and Reenviar for either the core or catalog permission", async () => {
    const { unmount } = renderPage(["core.notifications.read"], [failedDelivery])
    expect(await screen.findByText("Equipe")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: i18n.t("catalog.notifications.resend") })).not.toBeInTheDocument()
    unmount()

    renderPage(["catalog.notifications.read", "core.notifications.resend"], [failedDelivery])
    expect(await screen.findByRole("button", { name: i18n.t("catalog.notifications.resend") })).toBeInTheDocument()
    expect(listMock).toHaveBeenCalled()
  })
})

describe("catalog notification delivery schema", () => {
  const payload = {
    id: failedDelivery.id,
    notificationId: failedDelivery.notificationId,
    eventType: "catalog.order.created",
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

  it("parses a Sending row inside the delivery list", () => {
    const parsed = catalogNotificationDeliveryListSchema.parse([
      { ...payload, status: "Sending", errorMessage: null },
      payload,
    ])
    expect(parsed.map((row) => row.status)).toEqual(["Sending", "Failed"])
  })

  it("keeps the other deliveries when one attempt cannot be read", async () => {
    const user = userEvent.setup()
    const startedAt = "2026-10-20T17:40:00.000Z"
    const finishedAt = "2026-10-20T18:40:00.000Z"
    const goodAttempt = {
      attemptNumber: 2,
      startedAt,
      finishedAt,
      outcome: "PermanentFailure" as const,
      errorMessage: "WhatsApp recipient is missing.",
      channel: "WhatsApp" as const,
    }
    const parsed = catalogNotificationDeliveryListSchema.parse([
      {
        ...payload,
        attempts: [
          goodAttempt,
          { number: 9, timestamp: startedAt, error: "dropped", channel: "WhatsApp" },
        ],
      },
      {
        ...payload,
        id: "44444444-4444-4444-8444-444444444444",
        notificationId: "55555555-5555-4555-8555-555555555555",
        recipientName: "Outra entrega",
        status: "Sent",
        errorMessage: null,
        attempts: [],
      },
    ])

    expect(parsed).toHaveLength(2)
    expect(parsed[0].attempts).toEqual([goodAttempt])
    expect(parsed[1].recipientName).toBe("Outra entrega")

    renderPage(readAndResend, parsed.map((row) => ({
      ...row,
      eventKey: row.eventType,
      module: "catalog",
    })))
    expect(await screen.findByText("Outra entrega")).toBeInTheDocument()
    expect(screen.getByText("Equipe")).toBeInTheDocument()
    await user.click(screen.getAllByRole("button", { name: i18n.t("catalog.notifications.attempts") })[0])

    const history = screen.getByRole("region", { name: i18n.t("catalog.notifications.attemptsTitle") })
    expect(within(history).getByText(i18n.t("catalog.notifications.errors.whatsappMissing"))).toBeInTheDocument()
    expect(within(history).getByText(i18n.t("catalog.notifications.attemptOutcome.PermanentFailure"))).toBeInTheDocument()
    expect(within(history).queryByText("dropped")).not.toBeInTheDocument()
  })

  it("keeps an attempt that matches the API record", () => {
    const attempt = {
      attemptNumber: 1,
      startedAt: "2026-10-20T17:06:00.000Z",
      finishedAt: "2026-10-20T18:40:00.000Z",
      outcome: "PermanentFailure" as const,
      errorMessage: "missing",
      channel: "WhatsApp" as const,
    }
    expect(catalogNotificationDeliverySchema.parse({
      ...payload,
      attempts: [
        attempt,
        { number: 2, timestamp: attempt.startedAt, error: "missing", channel: "WhatsApp" },
      ],
    }).attempts).toEqual([attempt])
  })
})
