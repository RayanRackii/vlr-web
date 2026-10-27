import { fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

// These optional strings have no domain constraints today. Supply fixture issues
// at the validation boundary to exercise blur visibility with the real controls.
vi.mock("@/features/rentals/schemas/rentalResourceSchemas", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/features/rentals/schemas/rentalResourceSchemas")>()
  return {
    ...original,
    createRentalResourceFormSchema: (...args: Parameters<typeof original.createRentalResourceFormSchema>) =>
      original.createRentalResourceFormSchema(...args).superRefine((values, ctx) => {
        if (values.capacityPeople === "0") {
          ctx.addIssue({ code: "custom", path: ["capacityPeople"], message: "Capacity fixture error" })
        }
        if (values.visualTemplateRevisionId === "invalid-revision") {
          ctx.addIssue({ code: "custom", path: ["visualTemplateRevisionId"], message: "Template fixture error" })
        }
      }),
  }
})

vi.mock("@/features/rentals/services/resourceVisualService", () => ({
  listPickerTags: vi.fn().mockResolvedValue([]),
  listVisualTemplates: vi.fn().mockResolvedValue({ items: [{
    id: "template", slug: "fixture", nameI18n: { "pt-BR": "Fixture template" },
    publishedRevision: { id: "invalid-revision", suggestedCapacityPeople: null },
  }] }),
}))

import { RentalResourceSheet } from "@/features/rentals/components/RentalResourceSheet"
import { AuthProvider } from "@/contexts/AuthContext"
import { TestPermissionProvider } from "@/features/users/permissions/PermissionContext"
import i18n from "@/lib/i18n"

const id = "11111111-1111-1111-1111-111111111111"

async function renderVisualTab() {
  const user = userEvent.setup()
  render(
    <AuthProvider><TestPermissionProvider permissions={["rentals.assets.write"]}>
      <RentalResourceSheet open onOpenChange={vi.fn()} editing={null}
        units={[{ id, tenantId: id, name: "Matriz", isActive: true }]}
        categories={[{ id, name: "Quadra" }]}
        families={[{ id, key: "spaces", label: "Espaços", fields: [], sortOrder: 0, isActive: true }]}
        busy={false} readOnly={false} onSubmit={vi.fn().mockResolvedValue(true)} />
    </TestPermissionProvider></AuthProvider>,
  )
  await user.click(screen.getByRole("tab", { name: i18n.t("rentals.resources.sheetTabs.visual") }))
  return user
}

describe("RentalResourceSheet visual validation", () => {
  it("reveals capacity errors after blur before submit", async () => {
    const user = await renderVisualTab()
    const input = screen.getByRole("spinbutton", { name: i18n.t("resourceVisual.capacityPeople") })
    await user.type(input, "0")
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    await user.tab()
    expect(screen.getByRole("alert")).toHaveTextContent("Capacity fixture error")
  })

  it("reveals template errors when the template control is blurred before submit", async () => {
    const user = await renderVisualTab()
    const select = screen.getByRole("combobox", { name: i18n.t("resourceVisual.pickerTitle") })
    await user.click(select)
    await user.click(await screen.findByRole("option", { name: "Fixture template" }))
    fireEvent.blur(select)
    expect(screen.getByRole("alert")).toHaveTextContent("Template fixture error")
  })
})
