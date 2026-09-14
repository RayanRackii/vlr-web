import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { TrialBanner } from "@/components/layout/TrialBanner"
import { TestPermissionProvider } from "@/features/users/permissions/PermissionContext"
import type { CurrentUser } from "@/features/users/schemas/userSchemas"

const trialUser: CurrentUser = {
  id: "11111111-1111-4111-8111-111111111111",
  fullName: "Admin A",
  email: "admin-a@example.com",
  role: "ADMIN",
  tenantId: "22222222-2222-4222-8222-222222222222",
  activeModules: [],
  activeAssetFamilies: [],
  isTrial: true,
  isTrialReadOnly: false,
  trialEndsAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
  notificationsEmailOnly: false,
  roles: [],
  permissions: [],
}

describe("TrialBanner shared profile", () => {
  it("renders from PermissionProvider profile without fetching /me", () => {
    render(
      <TestPermissionProvider currentUser={trialUser}>
        <TrialBanner />
      </TestPermissionProvider>,
    )

    expect(screen.getByText(/Período de teste/i)).toBeInTheDocument()
  })

  it("hides when the shared profile is not on trial", () => {
    render(
      <TestPermissionProvider
        currentUser={{ ...trialUser, isTrial: false }}
      >
        <TrialBanner />
      </TestPermissionProvider>,
    )

    expect(screen.queryByText(/Período de teste/i)).not.toBeInTheDocument()
  })
})
