import type { ReactNode } from "react"
import { AuthError } from "@supabase/supabase-js"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { toast } from "sonner"

import { MainLayout } from "@/components/layout/MainLayout"
import {
  readActiveTenantLabel,
  readPlatformTenantExitedUserId,
} from "@/features/admin/hooks/usePlatformTenantSession"
import { api } from "@/lib/api"
import i18n from "@/lib/i18n"
import { supabase } from "@/lib/supabase"

const TENANT_ID = "22222222-2222-4222-8222-222222222222"

const authState = {
  user: {
    id: "user-platform",
    email: "pat@example.com",
    app_metadata: { tenant_id: TENANT_ID },
  } as {
    id: string
    email: string
    app_metadata: Record<string, unknown>
  },
  session: { access_token: "token" },
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

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}))

const apiGet = vi.mocked(api.get)
const apiPost = vi.mocked(api.post)
const refreshSession = vi.mocked(supabase.auth.refreshSession)

const meInsideTenant = {
  id: "11111111-1111-4111-8111-111111111111",
  fullName: "Pat Admin",
  email: "pat@example.com",
  role: "ADMIN",
  tenantId: TENANT_ID,
  activeModules: ["rentals"],
  activeAssetFamilies: [],
  isTrial: false,
  isTrialReadOnly: false,
  notificationsEmailOnly: false,
  roles: [],
  permissions: ["core.dashboard.read"],
}

function LocationProbe() {
  const location = useLocation()
  return <div data-testid="location">{location.pathname}</div>
}

function renderInsideTenant() {
  return render(
    <MemoryRouter initialEntries={["/dashboard"]}>
      <Routes>
        <Route element={<MainLayout />}>
          <Route path="/dashboard" element={<LocationProbe />} />
          <Route path="/admin/dashboard" element={<LocationProbe />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

const bannerText = i18n.t("admin.support.banner", { tenant: "Clube FICC" })

describe("Voltar à plataforma", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_PLATFORM_ADMIN_EMAILS", "pat@example.com")
    window.sessionStorage.clear()
    window.sessionStorage.setItem("rolvix.activeTenantLabel", "Clube FICC")
    authState.user = {
      id: "user-platform",
      email: "pat@example.com",
      app_metadata: { tenant_id: TENANT_ID },
    }
    apiGet.mockReset()
    apiPost.mockReset()
    refreshSession.mockReset()
    vi.mocked(toast.error).mockClear()
    refreshSession.mockResolvedValue({
      data: { session: null, user: null },
      error: null,
    })
    apiPost.mockResolvedValue({ data: null })
    apiGet.mockImplementation(async (url: string) => {
      if (String(url).includes("/api/users/me")) {
        return { data: meInsideTenant }
      }
      return { data: [] }
    })
  })

  it("clears the tenant context and opens the platform dashboard", async () => {
    const user = userEvent.setup()
    renderInsideTenant()

    const exit = await screen.findByRole("button", {
      name: i18n.t("admin.support.exit"),
    })
    await user.click(exit)

    await waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith("/api/admin/tenants/exit")
    })
    expect(readActiveTenantLabel()).toBeNull()
    expect(readPlatformTenantExitedUserId()).toBe("user-platform")
    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent("/admin/dashboard")
    })
    expect(screen.queryByText(bannerText)).not.toBeInTheDocument()
    expect(toast.error).not.toHaveBeenCalled()
  })

  it("still leaves the tenant when session refresh fails", async () => {
    refreshSession.mockResolvedValue({
      data: { session: null, user: null },
      error: new AuthError("lock", 500, "unexpected_failure"),
    })
    const user = userEvent.setup()
    renderInsideTenant()

    await user.click(
      await screen.findByRole("button", { name: i18n.t("admin.support.exit") }),
    )

    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent("/admin/dashboard")
    })
    expect(apiPost).toHaveBeenCalledWith("/api/admin/tenants/exit")
    expect(readPlatformTenantExitedUserId()).toBe("user-platform")
    expect(screen.queryByText(bannerText)).not.toBeInTheDocument()
    expect(toast.error).not.toHaveBeenCalled()
  })

  it("stays in the tenant when the exit API fails", async () => {
    apiPost.mockRejectedValue(new Error("network"))
    const user = userEvent.setup()
    renderInsideTenant()

    await user.click(
      await screen.findByRole("button", { name: i18n.t("admin.support.exit") }),
    )

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled()
    })
    expect(screen.getByTestId("location")).toHaveTextContent("/dashboard")
    expect(screen.getByText(bannerText)).toBeInTheDocument()
    expect(readActiveTenantLabel()).toBe("Clube FICC")
    expect(readPlatformTenantExitedUserId()).toBeNull()
  })
})
