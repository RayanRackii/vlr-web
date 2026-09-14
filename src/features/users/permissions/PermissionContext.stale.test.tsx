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

const profileTenantB: CurrentUser = {
  ...profile,
  tenantId: "44444444-4444-4444-8444-444444444444",
  email: "admin-a@example.com",
}

function Probe() {
  const { isLoading, currentUser, error, can } = usePermissions()
  if (isLoading) {
    return <PageContentSkeleton />
  }
  if (!can("core.notifications.read")) {
    return <p>denied:{error ?? "none"}</p>
  }
  return <p>ready:{currentUser?.tenantId ?? currentUser?.email}</p>
}

function Harness() {
  const [, setTick] = useState(0)
  return (
    <div>
      <button
        type="button"
        onClick={() => {
          authState.user = {
            ...authState.user,
            app_metadata: { tenant_id: "44444444-4444-4444-8444-444444444444" },
          }
          setTick((n) => n + 1)
        }}
      >
        switch-tenant
      </button>
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

    render(<Harness />)
    expect(screen.getByRole("status")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "switch-tenant" }))
    expect(getCurrentUserMock).toHaveBeenCalledTimes(2)

    resolveSecond(profileTenantB)
    await waitFor(() => {
      expect(
        screen.getByText("ready:44444444-4444-4444-8444-444444444444"),
      ).toBeInTheDocument()
    })

    rejectFirst(new Error("network"))
    await waitFor(() => {
      expect(screen.queryByRole("status")).not.toBeInTheDocument()
    })
    expect(
      screen.getByText("ready:44444444-4444-4444-8444-444444444444"),
    ).toBeInTheDocument()
    expect(screen.queryByText(/denied:/)).not.toBeInTheDocument()
  })
})
