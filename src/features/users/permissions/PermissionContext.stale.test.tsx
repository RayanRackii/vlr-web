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

const session = { isInTenantEnvironment: false }

vi.mock("@/features/admin/hooks/usePlatformTenantSession", () => ({
  usePlatformTenantSession: () => ({
    isPlatformAdmin: false,
    isInTenantEnvironment: session.isInTenantEnvironment,
    activeTenantId: null,
    activeTenantLabel: null,
    clearTenantLabel: () => undefined,
  }),
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

function Probe() {
  const { isLoading, currentUser, error, can } = usePermissions()
  if (isLoading) {
    return <PageContentSkeleton />
  }
  if (!can("core.notifications.read")) {
    return <p>denied:{error ?? "none"}</p>
  }
  return <p>ready:{currentUser?.email}</p>
}

function Harness() {
  const [, setTick] = useState(0)
  return (
    <div>
      <button
        type="button"
        onClick={() => {
          session.isInTenantEnvironment = true
          setTick((n) => n + 1)
        }}
      >
        enter-tenant
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
    session.isInTenantEnvironment = false
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

    await user.click(screen.getByRole("button", { name: "enter-tenant" }))
    expect(getCurrentUserMock).toHaveBeenCalledTimes(2)

    resolveSecond(profile)
    await waitFor(() => {
      expect(screen.getByText("ready:admin-a@example.com")).toBeInTheDocument()
    })

    rejectFirst(new Error("network"))
    await waitFor(() => {
      expect(screen.queryByRole("status")).not.toBeInTheDocument()
    })
    expect(screen.getByText("ready:admin-a@example.com")).toBeInTheDocument()
    expect(screen.queryByText(/denied:/)).not.toBeInTheDocument()
  })
})
