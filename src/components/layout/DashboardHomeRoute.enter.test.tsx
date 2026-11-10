import { useState } from "react"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { DashboardHomeRoute } from "@/components/layout/DashboardHomeRoute"
import { PermissionRoute } from "@/components/layout/PermissionRoute"
import {
  clearPlatformTenantExited,
  markPlatformTenantExited,
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

function Harness({ onEnter }: { onEnter: () => void }) {
  const [, setTick] = useState(0)
  return (
    <div>
      <button
        type="button"
        onClick={() => {
          onEnter()
          setTick((n) => n + 1)
        }}
      >
        enter-tenant
      </button>
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

function renderHome(onEnter: () => void) {
  return render(
    <MemoryRouter initialEntries={["/dashboard"]}>
      <Harness onEnter={onEnter} />
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
})
