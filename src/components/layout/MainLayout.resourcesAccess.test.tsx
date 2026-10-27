import type { ReactNode } from "react"
import { render, screen } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { MainLayout } from "@/components/layout/MainLayout"
import { PermissionRoute } from "@/components/layout/PermissionRoute"
import { RENTAL_RESOURCES_PERMISSIONS } from "@/components/layout/navigation"
import { resetCurrentUserCacheForTests } from "@/features/users/services/currentUserCache"
import { api } from "@/lib/api"
import i18n from "@/lib/i18n"

const authState = {
  user: {
    id: "user-a",
    email: "admin-a@example.com",
    app_metadata: {},
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
  activeModules: ["rentals"],
  activeAssetFamilies: [],
  isTrial: false,
  isTrialReadOnly: false,
  notificationsEmailOnly: false,
  roles: [],
  permissions: ["core.dashboard.read"],
}

function renderResources() {
  return render(
    <MemoryRouter initialEntries={["/configuracoes/recursos"]}>
      <Routes>
        <Route element={<MainLayout />}>
          <Route
            element={
              <PermissionRoute permissions={RENTAL_RESOURCES_PERMISSIONS} />
            }
          >
            <Route path="/configuracoes/recursos" element={<h1>Recursos</h1>} />
          </Route>
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe("Recursos permission before layout", () => {
  beforeEach(() => {
    resetCurrentUserCacheForTests()
    vi.stubEnv("VITE_PLATFORM_ADMIN_EMAILS", "")
    apiGet.mockReset()
  })

  it("does not paint the sidebar skeleton before Acesso negado", async () => {
    let resolveMe: (value: { data: typeof mePayload }) => void = () => {}
    apiGet.mockImplementation((url: string) => {
      if (String(url).includes("/api/users/me")) {
        return new Promise((resolve) => {
          resolveMe = resolve
        })
      }
      return Promise.resolve({ data: [] })
    })

    renderResources()

    expect(screen.queryByRole("navigation")).not.toBeInTheDocument()
    expect(
      screen.queryByRole("status", { name: i18n.t("nav.loading") }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("heading", { name: i18n.t("accessDenied.title") }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("heading", { name: "Recursos" }),
    ).not.toBeInTheDocument()

    resolveMe({ data: mePayload })

    expect(
      await screen.findByRole("heading", { name: i18n.t("accessDenied.title") }),
    ).toBeInTheDocument()
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument()
    expect(
      screen.queryByRole("status", { name: i18n.t("nav.loading") }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("heading", { name: "Recursos" }),
    ).not.toBeInTheDocument()
  })

  it("denies Recursos when only one of the required permissions is present", async () => {
    apiGet.mockImplementation(async (url: string) => {
      if (String(url).includes("/api/users/me")) {
        return {
          data: {
            ...mePayload,
            permissions: ["rentals.assets.read"],
          },
        }
      }
      return { data: [] }
    })

    renderResources()

    expect(
      await screen.findByRole("heading", { name: i18n.t("accessDenied.title") }),
    ).toBeInTheDocument()
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument()
    expect(
      screen.queryByRole("heading", { name: "Recursos" }),
    ).not.toBeInTheDocument()
  })

  it("renders the layout after the Recursos permission is granted", async () => {
    apiGet.mockImplementation(async (url: string) => {
      if (String(url).includes("/api/users/me")) {
        return {
          data: {
            ...mePayload,
            permissions: [...RENTAL_RESOURCES_PERMISSIONS],
          },
        }
      }
      return { data: [] }
    })

    renderResources()

    expect(
      await screen.findByRole("heading", { name: "Recursos" }),
    ).toBeInTheDocument()
    expect(screen.getByRole("navigation", { name: i18n.t("nav.menu") })).toBeInTheDocument()
    expect(screen.getByRole("navigation", { name: i18n.t("nav.breadcrumbLabel") })).toBeInTheDocument()
    expect(
      screen.queryByRole("heading", { name: i18n.t("accessDenied.title") }),
    ).not.toBeInTheDocument()
  })
})
