import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

vi.mock("@/components/inline-create/InlineCreateSelect", () => ({
  InlineCreateSelect: ({ canCreate = true, createLabel }: { canCreate?: boolean; createLabel: string }) => (
    canCreate ? <button type="button">{createLabel}</button> : null
  ),
}))
vi.mock("@/features/admin/hooks/usePlatformAdmin", () => ({ useIsPlatformAdmin: vi.fn().mockReturnValue(false) }))
vi.mock("@/features/rentals/services/resourceVisualService", () => ({
  listPickerTags: vi.fn().mockResolvedValue([]),
  listVisualTemplates: vi.fn().mockResolvedValue({ items: [] }),
}))

import { RentalResourceSheet } from "@/features/rentals/components/RentalResourceSheet"
import { TestPermissionProvider } from "@/features/users/permissions/PermissionContext"

const id = "11111111-1111-1111-1111-111111111111"

function renderSheet() {
  return render(
    <TestPermissionProvider permissions={["rentals.assets.write"]}>
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

describe("RentalResourceSheet tabs layout", () => {
  it("stacks the tab list above the panel instead of beside it", () => {
    renderSheet()

    const tabs = document.querySelector('[data-slot="tabs"]')
    expect(tabs).not.toBeNull()
    expect(tabs?.className).toContain("flex-col")
  })

  it("keeps the tab list horizontally scrollable with non-wrapping triggers", () => {
    renderSheet()

    const tabList = document.querySelector('[data-slot="tabs-list"]')
    expect(tabList?.className).toContain("overflow-x-auto")

    for (const trigger of screen.getAllByRole("tab")) {
      expect(trigger.className).toContain("whitespace-nowrap")
    }
  })
})
