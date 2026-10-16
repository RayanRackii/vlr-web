import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { StaffProfilePage } from "@/features/users/pages/StaffProfilePage"
import { TestPermissionProvider } from "@/features/users/permissions/PermissionContext"
import type { CurrentUser } from "@/features/users/schemas/userSchemas"
import i18n from "@/lib/i18n"

const teacher: CurrentUser = {
  id: "11111111-1111-4111-8111-111111111111",
  fullName: "Ana Professora",
  email: "ana@example.com",
  role: "USER",
  tenantId: "22222222-2222-4222-8222-222222222222",
  activeModules: ["rentals"],
  activeAssetFamilies: [],
  isTrial: false,
  isTrialReadOnly: false,
  notificationsEmailOnly: false,
  roles: [
    {
      id: "33333333-3333-4333-8333-333333333333",
      name: "Professor",
      isSystemRole: true,
    },
  ],
  permissions: ["rentals.schedule.read", "rentals.assets.read"],
}

describe("StaffProfilePage", () => {
  it("shows the signed-in staff name, email, and roles", () => {
    render(
      <TestPermissionProvider currentUser={teacher}>
        <StaffProfilePage />
      </TestPermissionProvider>,
    )

    expect(
      screen.getByRole("heading", { name: i18n.t("staffProfile.title") }),
    ).toBeInTheDocument()
    expect(screen.getAllByText("Ana Professora").length).toBeGreaterThan(0)
    expect(screen.getByText("ana@example.com")).toBeInTheDocument()
    expect(screen.getByText("Professor")).toBeInTheDocument()
    expect(screen.getByText("AP")).toBeInTheDocument()
  })
})
