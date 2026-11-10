import { useState } from "react"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { DashboardHomeRoute } from "@/components/layout/DashboardHomeRoute"
import { PermissionRoute } from "@/components/layout/PermissionRoute"
import {
  clearPlatformTenantExited,
  markPlatformTenantExited,
  readPlatformTenantExitedUserId,
} from "@/features/admin/hooks/usePlatformTenantSession"
import { PermissionProvider } from "@/features/users/permissions/PermissionContext"
import { getCurrentUser, type GetCurrentUserOptions } from "@/features/users/services/usersService"
import type { CurrentUser } from "@/features/users/schemas/userSchemas"
import i18n from "@/lib/i18n"

vi.mock("@/features/users/services/usersService", () => ({
  getCurrentUser: vi.fn(),
}))

const authState = {
  user: {
    id: "user-a",
    email: "pat@example.com",
    app_metadata: {} as Record<string, unknown>,
  },
  session: { user: { id: "user-a" } },
  isLoading: false,
}

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => authState,
}))

const getCurrentUserMock = vi.mocked(getCurrentUser)
const tenantId = "22222222-2222-4222-8222-222222222222"

const outsideTenant: CurrentUser = {
  id: null,
  fullName: "Pat",
  email: "pat@example.com",
  role: "SUPER_ADMIN",
  tenantId: null,
  activeModules: [],
  activeAssetFamilies: [],
  isTrial: false,
  isTrialReadOnly: false,
  notificationsEmailOnly: false,
  roles: [],
  permissions: [],
}

const insideTenant: CurrentUser = {
  ...outsideTenant,
  tenantId,
  activeModules: ["catalog"],
  permissions: ["core.users.read"],
}

const insideWithDashboard: CurrentUser = {
  ...insideTenant,
  permissions: ["core.dashboard.read", "core.users.read"],
}

function Harness({
  onEnter,
  onExit,
}: {
  onEnter?: () => void
  onExit?: () => void
}) {
  const navigate = useNavigate()
  const [, setTick] = useState(0)
  return (
    <div>
      {onEnter ? (
        <button
          type="button"
          onClick={() => {
            onEnter()
            setTick((n) => n + 1)
          }}
        >
          enter-tenant
        </button>
      ) : null}
      {onExit ? (
        <button
          type="button"
          onClick={() => {
            onExit()
            navigate("/dashboard")
            setTick((n) => n + 1)
          }}
        >
          exit-tenant
        </button>
      ) : null}
      <PermissionProvider>
        <Routes>
          <Route element={<DashboardHomeRoute />}>
            <Route path="/dashboard" element={<h1>Painel</h1>} />
          </Route>
          <Route element={<PermissionRoute permission="core.users.read" />}>
            <Route path="/pessoas-e-acesso" element={<h1>Pessoas</h1>} />
          </Route>
        </Routes>
      </PermissionProvider>
    </div>
  )
}

function renderHome(onEnter?: () => void, onExit?: () => void) {
  return render(
    <MemoryRouter initialEntries={["/dashboard"]}>
      <Harness onEnter={onEnter} onExit={onExit} />
    </MemoryRouter>,
  )
}

function denyHeading() {
  return screen.queryByRole("heading", { name: i18n.t("accessDenied.title") })
}

describe("DashboardHomeRoute tenant enter", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_PLATFORM_ADMIN_EMAILS", "pat@example.com")
    sessionStorage.clear()
    authState.user = {
      id: "user-a",
      email: "pat@example.com",
      app_metadata: {},
    }
    getCurrentUserMock.mockReset()
  })

  afterEach(() => {
    sessionStorage.clear()
    vi.unstubAllEnvs()
  })

  it("does not deny the dashboard when the first tenant /me is still the previous profile", async () => {
    const user = userEvent.setup()
    let forcedReads = 0
    getCurrentUserMock.mockImplementation((options?: GetCurrentUserOptions) => {
      const activeTenant = authState.user.app_metadata.tenant_id
      if (typeof activeTenant !== "string" || activeTenant.length === 0) {
        return Promise.resolve(outsideTenant)
      }
      if (!options?.force) {
        return Promise.resolve(outsideTenant)
      }
      forcedReads += 1
      return Promise.resolve(forcedReads === 1 ? outsideTenant : insideTenant)
    })

    renderHome(() => {
      authState.user = {
        ...authState.user,
        app_metadata: { tenant_id: tenantId },
      }
    })

    expect(await screen.findByRole("heading", { name: "Painel" })).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "enter-tenant" }))

    let sawDenied = false
    await waitFor(() => {
      if (denyHeading()) {
        sawDenied = true
      }
      expect(screen.getByRole("heading", { name: "Pessoas" })).toBeInTheDocument()
    })
    expect(sawDenied).toBe(false)
    expect(denyHeading()).not.toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: "Painel" })).not.toBeInTheDocument()
  })

  it("reloads /me when enter clears a local exit and the JWT already names the tenant", async () => {
    const user = userEvent.setup()
    authState.user = {
      ...authState.user,
      app_metadata: { tenant_id: tenantId },
    }
    markPlatformTenantExited("user-a")
    let forcedReads = 0
    getCurrentUserMock.mockImplementation((options?: GetCurrentUserOptions) => {
      if (!options?.force) {
        return Promise.resolve(outsideTenant)
      }
      forcedReads += 1
      return Promise.resolve(forcedReads === 1 ? outsideTenant : insideWithDashboard)
    })

    renderHome(() => {
      clearPlatformTenantExited()
    })

    expect(await screen.findByRole("heading", { name: "Painel" })).toBeInTheDocument()
    expect(denyHeading()).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "enter-tenant" }))

    let sawDenied = false
    await waitFor(() => {
      if (denyHeading()) {
        sawDenied = true
      }
      expect(forcedReads).toBeGreaterThanOrEqual(2)
      expect(screen.getByRole("heading", { name: "Painel" })).toBeInTheDocument()
    })
    expect(sawDenied).toBe(false)
    expect(denyHeading()).not.toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: "Pessoas" })).not.toBeInTheDocument()
  })

  it("leaves the dashboard when the tenant profile has no dashboard permission", async () => {
    const user = userEvent.setup()
    getCurrentUserMock.mockImplementation((options?: GetCurrentUserOptions) => {
      const activeTenant = authState.user.app_metadata.tenant_id
      if (typeof activeTenant !== "string" || activeTenant.length === 0 || !options?.force) {
        return Promise.resolve(outsideTenant)
      }
      return Promise.resolve(insideTenant)
    })

    renderHome(() => {
      authState.user = {
        ...authState.user,
        app_metadata: { tenant_id: tenantId },
      }
    })

    expect(await screen.findByRole("heading", { name: "Painel" })).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "enter-tenant" }))

    expect(await screen.findByRole("heading", { name: "Pessoas" })).toBeInTheDocument()
    expect(denyHeading()).not.toBeInTheDocument()
  })

  it("shows the platform dashboard after leaving the tenant", async () => {
    const user = userEvent.setup()
    authState.user = {
      ...authState.user,
      app_metadata: { tenant_id: tenantId },
    }
    getCurrentUserMock.mockImplementation(() =>
      Promise.resolve(
        readPlatformTenantExitedUserId() === "user-a" ? outsideTenant : insideTenant,
      ),
    )

    renderHome(undefined, () => {
      markPlatformTenantExited("user-a")
    })

    expect(await screen.findByRole("heading", { name: "Pessoas" })).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "exit-tenant" }))

    expect(await screen.findByRole("heading", { name: "Painel" })).toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: "Pessoas" })).not.toBeInTheDocument()
    expect(denyHeading()).not.toBeInTheDocument()
  })

  it("retries a stale /me when the same tenant is entered again after exit", async () => {
    const user = userEvent.setup()
    let phase: "boot" | "in" | "out" | "back" = "boot"
    const forceReads = { in: 0, back: 0 }
    getCurrentUserMock.mockImplementation((options?: GetCurrentUserOptions) => {
      if (phase === "boot" || phase === "out" || !options?.force) {
        return Promise.resolve(outsideTenant)
      }
      const key = phase === "in" ? "in" : "back"
      forceReads[key] += 1
      return Promise.resolve(forceReads[key] === 1 ? outsideTenant : insideTenant)
    })

    renderHome(
      () => {
        phase = phase === "out" ? "back" : "in"
        clearPlatformTenantExited()
        authState.user = {
          ...authState.user,
          app_metadata: { tenant_id: tenantId },
        }
      },
      () => {
        phase = "out"
        markPlatformTenantExited("user-a")
      },
    )

    expect(await screen.findByRole("heading", { name: "Painel" })).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "enter-tenant" }))
    expect(await screen.findByRole("heading", { name: "Pessoas" })).toBeInTheDocument()
    expect(forceReads.in).toBeGreaterThanOrEqual(2)

    await user.click(screen.getByRole("button", { name: "exit-tenant" }))
    expect(await screen.findByRole("heading", { name: "Painel" })).toBeInTheDocument()
    expect(denyHeading()).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "enter-tenant" }))
    expect(await screen.findByRole("heading", { name: "Pessoas" })).toBeInTheDocument()
    expect(forceReads.back).toBeGreaterThanOrEqual(2)
    expect(denyHeading()).not.toBeInTheDocument()
  })

  it("keeps loading when the retried /me is still for another tenant", async () => {
    const user = userEvent.setup()
    let forcedReads = 0
    getCurrentUserMock.mockImplementation((options?: GetCurrentUserOptions) => {
      const activeTenant = authState.user.app_metadata.tenant_id
      if (typeof activeTenant !== "string" || activeTenant.length === 0) {
        return Promise.resolve(outsideTenant)
      }
      if (options?.force) {
        forcedReads += 1
      }
      return Promise.resolve(outsideTenant)
    })

    renderHome(() => {
      authState.user = {
        ...authState.user,
        app_metadata: { tenant_id: tenantId },
      }
    })

    expect(await screen.findByRole("heading", { name: "Painel" })).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "enter-tenant" }))

    await waitFor(() => {
      expect(forcedReads).toBeGreaterThanOrEqual(2)
    })
    expect(screen.getByRole("status")).toBeInTheDocument()
    expect(denyHeading()).not.toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: "Painel" })).not.toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: "Pessoas" })).not.toBeInTheDocument()
  })
})
