import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

vi.mock("@/features/admin/hooks/usePlatformAdmin", () => ({ useIsPlatformAdmin: vi.fn().mockReturnValue(false) }))
vi.mock("@/features/rentals/services/resourceVisualService", () => ({
  listPickerTags: vi.fn().mockResolvedValue([]),
  listVisualTemplates: vi.fn().mockResolvedValue({ items: [] }),
}))

import { RentalResourceEditorForm } from "@/features/rentals/components/RentalResourceEditorForm"
import { toCreateRentableRequest, type RentalResourceFormValues } from "@/features/rentals/schemas/rentalResourceSchemas"
import type { AdminRentalAsset } from "@/features/rentals/services/scheduleService"
import { TestPermissionProvider } from "@/features/users/permissions/PermissionContext"
import i18n from "@/lib/i18n"

const id = "11111111-1111-1111-1111-111111111111"
const family = {
  id,
  key: "electrical",
  label: "Equipamentos elétricos",
  fields: [
    { key: "voltage", type: "number", required: true, label: "Voltagem" },
    { key: "brand", type: "text", required: false, label: "Marca" },
  ],
  sortOrder: 0,
  isActive: true,
}

function renderForm(props: { editing?: AdminRentalAsset | null; onSubmit?: (values: RentalResourceFormValues) => Promise<boolean> } = {}) {
  const onSubmit = props.onSubmit ?? vi.fn().mockResolvedValue(true)
  render(
    <TestPermissionProvider permissions={["rentals.assets.write"]}>
      <RentalResourceEditorForm
        onCancel={vi.fn()}
        editing={props.editing ?? null}
        units={[{ id, tenantId: id, name: "Matriz", isActive: true }]}
        categories={[{ id, name: "Quadra" }]}
        families={[family]}
        busy={false}
        readOnly={false}
        onSubmit={onSubmit}
      />
    </TestPermissionProvider>,
  )
  return onSubmit
}

describe("RentalResourceEditorForm family attributes", () => {
  it("renders the family fields, blocks submit while a required one is empty and submits attributes", async () => {
    const user = userEvent.setup()
    const onSubmit = renderForm()
    await user.type(screen.getByLabelText(i18n.t("rentals.resources.form.name")), "Furadeira")

    const voltage = screen.getByLabelText(/Voltagem/)
    expect(voltage).toHaveAttribute("aria-required", "true")
    expect(screen.getByLabelText(/Marca/)).toBeInTheDocument()
    const save = screen.getByRole("button", { name: i18n.t("rentals.resources.saveCreate") })
    expect(save).toBeDisabled()

    await user.type(voltage, "220")
    await waitFor(() => expect(save).toBeEnabled())
    await user.click(save)

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    const values = vi.mocked(onSubmit).mock.calls[0]![0]
    expect(values.attributes).toEqual({ voltage: "220", brand: "" })
    expect(toCreateRentableRequest(values).attributes).toEqual({ voltage: "220", brand: null })
  })

  it("loads stored attributes on edit and lets a legacy asset with a blank required field save", async () => {
    const user = userEvent.setup()
    const editing = {
      id: "22222222-2222-2222-2222-222222222222", assetId: "33333333-3333-3333-3333-333333333333",
      familyId: id, attributes: { brand: "Acme" }, unitId: id, categoryId: id, name: "Furadeira", tag: "F1", type: "Good", totalQuantity: 1,
    } as unknown as AdminRentalAsset
    const onSubmit = renderForm({ editing })

    expect(await screen.findByDisplayValue("Acme")).toBeInTheDocument()
    await user.type(screen.getByLabelText(i18n.t("rentals.resources.form.name")), " 2")
    const save = screen.getByRole("button", { name: i18n.t("rentals.resources.saveEdit") })
    await waitFor(() => expect(save).toBeEnabled())
    await user.click(save)

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    expect(vi.mocked(onSubmit).mock.calls[0]![0].attributes).toEqual({ voltage: "", brand: "Acme" })
  })
})
