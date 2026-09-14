import { useState } from "react"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { PageContentSkeleton } from "@/components/loading/PageContentSkeleton"
import {
  PermissionProvider,
  usePermissions,
} from "@/features/users/permissions/PermissionContext"
import { getCurrentUser } from "@/features/users/services/usersService"
import type { CurrentUser } from "@/features/users/schemas/userSchemas"

vi.mock("@/features/users/services/usersService", () => ({
  getCurrentUser: vi.fn(),
}))

const authState = {
  user: {
    id: "user-a",
    email: "admin-a@example.com",
    app_metadata: {} as Record<string, unknown>,
  },
  session: {},
  isLoading: false,
}

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => authState,
}))

const getCurrentUserMock = vi.mocked(getCurrentUser)

const profile: CurrentUser = {
  id: "11111111-1111-4111-8111-111111111111",
  fullName: "Admin A",
  email: "admin-a@example.com",
  role: "ADMIN",
  tenantId: "22222222-2222-4222-8222-222222222222",
  activeModules: ["catalog"],
  activeAssetFamilies: [],
  isTrial: false,
  isTrialReadOnly: false,
  notificationsEmailOnly: false,
  roles: [],
  permissions: ["core.notifications.read"],
}

const profileB: CurrentUser = {
  ...profile,
  id: "33333333-3333-4333-8333-333333333333",
  fullName: "Admin B",
  email: "admin-b@example.com",
  tenantId: "55555555-5555-4555-8555-555555555555",
  activeModules: ["rentals"],
  permissions: ["rentals.reservations.read"],
}

const profileTenantB: CurrentUser = {
  ...profile,
  tenantId: "44444444-4444-4444-8444-444444444444",
  activeModules: ["rentals"],
  permissions: ["core.notifications.read", "rentals.schedule.read"],
}

function Probe() {
  const { isLoading, currentUser, error, can } = usePermissions()
  if (isLoading) {
    return <PageContentSkeleton />
  }
  if (!currentUser) {
    return <p>denied:{error ?? "none"}</p>
  }
  return (
    <div>
      <p>ready:{currentUser.email}</p>
      <p>tenant:{currentUser.tenantId}</p>
      <p>modules:{currentUser.activeModules.join(",")}</p>
      <p>canNotify:{String(can("core.notifications.read"))}</p>
    </div>
  )
}

function Harness({
  onSwitchTenant,
  onLogout,
  onLoginB,
  onEnterA,
  onExit,
  onExitThenEnterB,
}: {
  onSwitchTenant?: () => void
  onLogout?: () => void
  onLoginB?: () => void
  onEnterA?: () => void
  onExit?: () => void
  onExitThenEnterB?: () => void
}) {
  const [, setTick] = useState(0)
  function bump(mutate: () => void) {
    mutate()
    setTick((n) => n + 1)
  }
  return (
    <div>
      {onSwitchTenant ? (
        <button
          type="button"
          onClick={() =>
            bump(() => {
              authState.user = {
                ...authState.user,
                app_metadata: {
                  tenant_id: "44444444-4444-4444-8444-444444444444",
                },
              }
            })
          }
        >
          switch-tenant
        </button>
      ) : null}
      {onLogout ? (
        <button type="button" onClick={() => bump(() => {
          authState.user = { id: "", email: "", app_metadata: {} }
        })}>
          logout
        </button>
      ) : null}
      {onLoginB ? (
        <button
          type="button"
          onClick={() =>
            bump(() => {
              authState.user = {
                id: "user-b",
                email: "admin-b@example.com",
                app_metadata: {},
              }
            })
          }
        >
          login-b
        </button>
      ) : null}
      {onEnterA ? (
        <button
          type="button"
          onClick={() =>
            bump(() => {
              authState.user = {
                ...authState.user,
                app_metadata: {
                  tenant_id: "22222222-2222-4222-8222-222222222222",
                },
              }
            })
          }
        >
          enter-a
        </button>
      ) : null}
      {onExit ? (
        <button
          type="button"
          onClick={() =>
            bump(() => {
              authState.user = {
                ...authState.user,
                app_metadata: {},
              }
            })
          }
        >
          exit-tenant
        </button>
      ) : null}
      {onExitThenEnterB ? (
        <button
          type="button"
          onClick={() =>
            bump(() => {
              authState.user = {
                ...authState.user,
                app_metadata: {
                  tenant_id: "44444444-4444-4444-8444-444444444444",
                },
              }
            })
          }
        >
          enter-b
        </button>
      ) : null}
      <PermissionProvider>
        <Probe />
      </PermissionProvider>
    </div>
  )
}

describe("PermissionProvider stale /me", () => {
  beforeEach(() => {
    getCurrentUserMock.mockReset()
    authState.user = {
      id: "user-a",
      email: "admin-a@example.com",
      app_metadata: {},
    }
  })

  it("F: a stale failure cannot overwrite a newer successful profile", async () => {
    const user = userEvent.setup()
    let rejectFirst!: (reason: Error) => void
    let resolveSecond!: (value: CurrentUser) => void

    getCurrentUserMock
      .mockImplementationOnce(
        () =>
          new Promise((_, reject) => {
            rejectFirst = reject
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveSecond = resolve
          }),
      )

    render(<Harness onSwitchTenant />)
    expect(screen.getByRole("status")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "switch-tenant" }))
    expect(getCurrentUserMock).toHaveBeenCalledTimes(2)

    resolveSecond(profileTenantB)
    await waitFor(() => {
      expect(
        screen.getByText("tenant:44444444-4444-4444-8444-444444444444"),
      ).toBeInTheDocument()
    })

    rejectFirst(new Error("network"))
    await waitFor(() => {
      expect(screen.queryByRole("status")).not.toBeInTheDocument()
    })
    expect(
      screen.getByText("tenant:44444444-4444-4444-8444-444444444444"),
    ).toBeInTheDocument()
    expect(screen.queryByText(/denied:/)).not.toBeInTheDocument()
  })

  it("A: logout then login as B issues a new /me and does not keep A", async () => {
    const user = userEvent.setup()
    getCurrentUserMock.mockImplementation(async () => {
      if (authState.user.id === "user-b") {
        return profileB
      }
      if (!authState.user.id) {
        throw new Error("unauthenticated")
      }
      return profile
    })

    render(<Harness onLogout onLoginB />)

    await waitFor(() => {
      expect(screen.getByText("ready:admin-a@example.com")).toBeInTheDocument()
    })
    expect(screen.getByText("modules:catalog")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "logout" }))
    await user.click(screen.getByRole("button", { name: "login-b" }))

    await waitFor(() => {
      expect(screen.getByText("ready:admin-b@example.com")).toBeInTheDocument()
    })
    expect(screen.getByText("modules:rentals")).toBeInTheDocument()
    expect(screen.getByText("canNotify:false")).toBeInTheDocument()
    expect(screen.queryByText("ready:admin-a@example.com")).not.toBeInTheDocument()
    expect(getCurrentUserMock.mock.calls.length).toBeGreaterThanOrEqual(2)
  })

  it("B/C: tenant enter then A→B reloads a fresh tenant B profile", async () => {
    const user = userEvent.setup()
    const platformHome: CurrentUser = {
      ...profile,
      tenantId: null,
      activeModules: [],
      permissions: [],
      role: "SUPER_ADMIN",
    }
    getCurrentUserMock
      .mockResolvedValueOnce(platformHome)
      .mockResolvedValueOnce(profile)
      .mockResolvedValueOnce(profileTenantB)

    authState.user = {
      id: "user-a",
      email: "admin-a@example.com",
      app_metadata: {},
    }

    render(<Harness onEnterA onExitThenEnterB />)

    await waitFor(() => {
      expect(screen.getByText("ready:admin-a@example.com")).toBeInTheDocument()
    })
    expect(screen.getByText("modules:")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "enter-a" }))
    await waitFor(() => {
      expect(screen.getByText("modules:catalog")).toBeInTheDocument()
    })

    await user.click(screen.getByRole("button", { name: "enter-b" }))
    await waitFor(() => {
      expect(screen.getByText("modules:rentals")).toBeInTheDocument()
    })
    expect(
      screen.getByText("tenant:44444444-4444-4444-8444-444444444444"),
    ).toBeInTheDocument()
    expect(screen.queryByText("modules:catalog")).not.toBeInTheDocument()
    expect(getCurrentUserMock).toHaveBeenCalledTimes(3)
  })

  it("C: tenant A → exit → tenant B does not retain A modules", async () => {
    const user = userEvent.setup()
    const platformHome: CurrentUser = {
      ...profile,
      tenantId: null,
      activeModules: [],
      permissions: [],
      role: "SUPER_ADMIN",
    }
    getCurrentUserMock
      .mockResolvedValueOnce(profile)
      .mockResolvedValueOnce(platformHome)
      .mockResolvedValueOnce(profileTenantB)

    authState.user = {
      id: "user-a",
      email: "admin-a@example.com",
      app_metadata: {
        tenant_id: "22222222-2222-4222-8222-222222222222",
      },
    }

    render(<Harness onExit onExitThenEnterB />)

    await waitFor(() => {
      expect(screen.getByText("modules:catalog")).toBeInTheDocument()
    })

    await user.click(screen.getByRole("button", { name: "exit-tenant" }))
    await waitFor(() => {
      expect(screen.getByText("modules:")).toBeInTheDocument()
    })
    expect(screen.queryByText("modules:catalog")).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "enter-b" }))
    await waitFor(() => {
      expect(screen.getByText("modules:rentals")).toBeInTheDocument()
    })
    expect(
      screen.getByText("tenant:44444444-4444-4444-8444-444444444444"),
    ).toBeInTheDocument()
    expect(screen.queryByText("modules:catalog")).not.toBeInTheDocument()
    expect(getCurrentUserMock).toHaveBeenCalledTimes(3)
  })
})
