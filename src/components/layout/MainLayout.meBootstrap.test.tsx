import type { ReactNode } from "react"
import { render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { MainLayout } from "@/components/layout/MainLayout"
import { PermissionRoute } from "@/components/layout/PermissionRoute"
import { NotificationsSettingsPage } from "@/features/notifications/pages/NotificationsSettingsPage"
import {
  listNotificationChannelConfigs,
} from "@/features/notifications/services/notificationChannelConfigService"
import { resetCurrentUserCacheForTests } from "@/features/users/services/currentUserCache"
import { api } from "@/lib/api"
import i18n from "@/lib/i18n"

const authState = {
  user: {
    id: "user-a",
    email: "admin-a@example.com",
    app_metadata: {},
  } as {
    id: string
    email: string
    app_metadata: Record<string, unknown>
  },
  session: {},
  isLoading: false,
}

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => authState,
  AuthProvider: ({ children }: { children: ReactNode }) => children,
}))

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>()
  return {
    ...actual,
    api: {
      get: vi.fn(),
      put: vi.fn(),
      post: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
    },
  }
})

vi.mock("@/features/notifications/services/notificationChannelConfigService", () => ({
  listNotificationChannelConfigs: vi.fn(),
  updateNotificationChannelConfig: vi.fn(),
}))

const apiGet = vi.mocked(api.get)
const listConfigs = vi.mocked(listNotificationChannelConfigs)

const mePayload = {
  id: "11111111-1111-4111-8111-111111111111",
  fullName: "Admin A",
  email: "admin-a@example.com",
  role: "ADMIN",
  tenantId: "22222222-2222-4222-8222-222222222222",
  activeModules: ["catalog", "rentals"],
  activeAssetFamilies: [],
  isTrial: false,
  isTrialReadOnly: false,
  notificationsEmailOnly: false,
  roles: [],
  permissions: ["core.notifications.read", "core.dashboard.read"],
}

describe("MainLayout current-user bootstrap", () => {
  beforeEach(() => {
    resetCurrentUserCacheForTests()
    vi.stubEnv("VITE_PLATFORM_ADMIN_EMAILS", "")
    apiGet.mockReset()
    listConfigs.mockReset()
    listConfigs.mockResolvedValue([
      {
        module: "catalog",
        events: [
          {
            eventType: "catalog.order.created",
            displayKey: "catalog.events.orderCreated",
            channels: [
              { channel: "Email", isActive: false, configurable: true },
            ],
          },
        ],
      },
    ])
    apiGet.mockImplementation(async (url: string) => {
      if (String(url).includes("/api/users/me")) {
        return { data: mePayload }
      }
      return { data: [] }
    })
  })

  it("fires a single GET /api/users/me for the full notifications shell", async () => {
    render(
      <MemoryRouter initialEntries={["/configuracoes/notificacoes"]}>
        <Routes>
          <Route element={<MainLayout />}>
            <Route
              element={<PermissionRoute permission="core.notifications.read" />}
            >
              <Route
                path="/configuracoes/notificacoes"
                element={<h1>Notificações</h1>}
              />
            </Route>
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByRole("heading", { name: "Notificações" })).toBeInTheDocument()

    await waitFor(() => {
      const meCalls = apiGet.mock.calls.filter((call) =>
        String(call[0]).includes("/api/users/me"),
      )
      expect(meCalls).toHaveLength(1)
    })
  })

  it("waits for one /me then loads channel-configs and the notifications table", async () => {
    render(
      <MemoryRouter initialEntries={["/configuracoes/notificacoes"]}>
        <Routes>
          <Route element={<MainLayout />}>
            <Route
              element={<PermissionRoute permission="core.notifications.read" />}
            >
              <Route
                path="/configuracoes/notificacoes"
                element={<NotificationsSettingsPage />}
              />
            </Route>
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    expect(
      await screen.findByRole("heading", {
        name: i18n.t("notifications.settings.title"),
      }),
    ).toBeInTheDocument()
    await waitFor(() => {
      expect(listConfigs).toHaveBeenCalledTimes(1)
    })
    expect(
      await screen.findByText(i18n.t("catalog.events.orderCreated")),
    ).toBeInTheDocument()

    const meCalls = apiGet.mock.calls.filter((call) =>
      String(call[0]).includes("/api/users/me"),
    )
    expect(meCalls).toHaveLength(1)
    expect(screen.queryByRole("status")).not.toBeInTheDocument()
  })
})
