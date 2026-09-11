import { render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { CatalogNotificationsPage } from "@/features/catalog/pages/CatalogNotificationsPage"
import { listCatalogNotifications } from "@/features/catalog/services/catalogService"
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

describe("CatalogNotificationsPage", () => {
  beforeEach(() => {
    listMock.mockReset()
    listMock.mockResolvedValue([])
  })

  it("is history-only and does not render the channel matrix", async () => {
    render(
      <TestPermissionProvider permissions={["catalog.notifications.read"]}>
        <CatalogNotificationsPage />
      </TestPermissionProvider>,
    )

    await waitFor(() => {
      expect(listMock).toHaveBeenCalled()
    })

    expect(
      screen.getByText(i18n.t("catalog.notifications.subtitle")),
    ).toBeInTheDocument()
    expect(
      screen.queryByText(i18n.t("catalog.notifications.channelsTitle")),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText(i18n.t("catalog.notifications.smsUnavailable")),
    ).not.toBeInTheDocument()
  })
})
