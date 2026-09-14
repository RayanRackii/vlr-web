import type { ReactNode } from "react"
import { render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { MainLayout } from "@/components/layout/MainLayout"
import { PermissionRoute } from "@/components/layout/PermissionRoute"
import { resetCurrentUserCacheForTests } from "@/features/users/services/currentUserCache"
import { api } from "@/lib/api"

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

const apiGet = vi.mocked(api.get)

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
})
