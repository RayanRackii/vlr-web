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
        <TrialBanner informational />
      </TestPermissionProvider>,
    )

    expect(screen.getByText(/Período de teste/i)).toBeInTheDocument()
  })

  it("hides when the shared profile is not on trial", () => {
    render(
      <TestPermissionProvider
        currentUser={{ ...trialUser, isTrial: false, isTrialReadOnly: true }}
      >
        <TrialBanner informational />
      </TestPermissionProvider>,
    )

    expect(screen.queryByText(/Período de teste/i)).not.toBeInTheDocument()
  })

  it("presents dashboard read-only access as a polite informational notice", () => {
    render(
      <TestPermissionProvider currentUser={{
        ...trialUser,
        isTrialReadOnly: true,
        trialPurgeAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      }}>
        <TrialBanner informational />
      </TestPermissionProvider>,
    )

    expect(screen.getByRole("status")).toHaveTextContent("Você pode consultar seus dados")
    expect(screen.getByRole("status")).toHaveTextContent("7")
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  it("keeps the existing read-only notice outside the staff dashboard", () => {
    render(
      <TestPermissionProvider currentUser={{ ...trialUser, isTrialReadOnly: true }}>
        <TrialBanner />
      </TestPermissionProvider>,
    )
    expect(screen.getByText(/Teste encerrado — conta somente leitura/)).toBeInTheDocument()
    expect(screen.queryByRole("status")).not.toBeInTheDocument()
  })
})
