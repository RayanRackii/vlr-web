import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

vi.mock("@/components/inline-create/InlineCreateSelect", () => ({
  InlineCreateSelect: ({ canCreate = true, createLabel }: { canCreate?: boolean; createLabel: string }) => (
    canCreate ? <button type="button">{createLabel}</button> : null
  ),
}))
vi.mock("@/features/admin/hooks/usePlatformAdmin", () => ({ useIsPlatformAdmin: vi.fn() }))
vi.mock("@/features/rentals/services/resourceVisualService", () => ({
  listPickerTags: vi.fn().mockResolvedValue([]),
  listVisualTemplates: vi.fn().mockResolvedValue({ items: [] }),
}))

import { useIsPlatformAdmin } from "@/features/admin/hooks/usePlatformAdmin"
import { RentalResourceSheet } from "@/features/rentals/components/RentalResourceSheet"
import { TestPermissionProvider } from "@/features/users/permissions/PermissionContext"

const id = "11111111-1111-1111-1111-111111111111"

function renderSheet(options: { activeModules: string[]; permissions?: string[]; isPlatformAdmin: boolean }) {
  vi.mocked(useIsPlatformAdmin).mockReturnValue(options.isPlatformAdmin)

  return render(
    <TestPermissionProvider activeModules={options.activeModules} permissions={options.permissions}>
      <RentalResourceSheet
        open
        onOpenChange={vi.fn()}
        editing={null}
        units={[{ id, tenantId: id, name: "Matriz", isActive: true }]}
        categories={[{ id, name: "Quadra" }]}
        families={[{ id, key: "spaces", label: "Espaços", fields: [], sortOrder: 0, isActive: true }]}
        busy={false}
        readOnly={false}
        onSubmit={vi.fn().mockResolvedValue(true)}
      />
    </TestPermissionProvider>,
  )
}

describe("RentalResourceSheet inline dependency creation", () => {
  it("hides type creation for a rentals-only tenant", () => {
    renderSheet({
      activeModules: ["rentals"],
      permissions: ["inventory.categories.write"],
      isPlatformAdmin: false,
    })

    expect(screen.queryByRole("button", { name: "+ criar tipo" })).not.toBeInTheDocument()
  })

  it("shows type creation only with inventory and its category-write permission", () => {
    renderSheet({
      activeModules: ["rentals", "inventory"],
      permissions: ["inventory.categories.write"],
      isPlatformAdmin: false,
    })

    expect(screen.getByRole("button", { name: "+ criar tipo" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /criar modelo global/i })).not.toBeInTheDocument()
  })

  it("shows global template creation only for a super-admin", () => {
    renderSheet({ activeModules: ["rentals"], isPlatformAdmin: true })

    expect(screen.getByRole("button", { name: "+ criar modelo global (Rolvix)" })).toBeInTheDocument()
  })
})
