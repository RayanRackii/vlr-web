import { fireEvent, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

// Supply only a template fixture issue; capacity uses the real domain validation.
vi.mock("@/features/rentals/schemas/rentalResourceSchemas", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/features/rentals/schemas/rentalResourceSchemas")>()
  return {
    ...original,
    createRentalResourceFormSchema: (...args: Parameters<typeof original.createRentalResourceFormSchema>) =>
      original.createRentalResourceFormSchema(...args).superRefine((values, ctx) => {
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
        categories={[{ id, name: "Espaço" }]}
        families={[{ id, key: "spaces", label: "Espaços", fields: [], sortOrder: 0, isActive: true }]}
        busy={false} readOnly={false} onSubmit={vi.fn().mockResolvedValue(true)} />
    </TestPermissionProvider></AuthProvider>,
  )
  await user.click(screen.getByRole("tab", { name: i18n.t("rentals.resources.sheetTabs.visual") }))
  return user
}

describe("RentalResourceSheet visual validation", () => {
  it.each([
    ["horizonLabel", "horizonDaysMode", "horizonDays", "horizonRange", "3651"],
    ["cancelCutoffLabel", "cancelCutoffHours", "cancelCutoffHours", "cancelCutoffRange", "8761"],
  ])("shows %s errors on blur while keeping static guidance valid", async (modeLabel, optionLabel, fieldLabel, messageKey, invalidValue) => {
    const user = await renderVisualTab()
    await user.click(screen.getByRole("tab", { name: i18n.t("rentals.resources.sheetTabs.pricingRules") }))
    const choices = screen.getByRole("radiogroup", { name: i18n.t(`rentals.resources.form.${modeLabel}`) })
    await user.click(within(choices).getByRole("radio", { name: i18n.t(`rentals.resources.form.${optionLabel}`) }))
    const input = screen.getByRole("textbox", { name: i18n.t(`rentals.resources.form.${fieldLabel}`) })
    const message = i18n.t(`rentals.resources.validation.${messageKey}`)
    const helperId = input.getAttribute("aria-describedby")!
    expect(input).toHaveAccessibleDescription(message)
    expect(input).toHaveAttribute("aria-invalid", "false")
    await user.clear(input)
    await user.type(input, invalidValue)
    expect(input).toHaveAttribute("aria-describedby", helperId)
    expect(input).toHaveAttribute("aria-invalid", "false")
    await user.tab()
    expect(input).toHaveAttribute("aria-invalid", "true")
    const describedIds = input.getAttribute("aria-describedby")!.split(" ")
    expect(describedIds).toHaveLength(2)
    expect(describedIds).toContain(helperId)
    for (const id of describedIds) {
      expect(document.getElementById(id)).toBeVisible()
      expect(document.getElementById(id)).toHaveTextContent(message)
    }
    await user.clear(input)
    await user.type(input, "1")
    expect(input).toHaveAttribute("aria-invalid", "false")
    expect(input).toHaveAttribute("aria-describedby", helperId)
    expect(input).toHaveAccessibleDescription(message)
  })

  it("links the empty queue opening time error after blur and removes it when corrected", async () => {
    const user = await renderVisualTab()
    await user.click(screen.getByRole("tab", { name: i18n.t("rentals.resources.sheetTabs.pricingRules") }))
    await user.click(screen.getByRole("switch", { name: i18n.t("rentals.resources.form.queueEnabled") }))
    const input = screen.getByLabelText(i18n.t("rentals.resources.form.queueOpeningTime"))
    const message = i18n.t("rentals.resources.validation.queueOpeningTimeRequired")
    expect(input).toHaveAttribute("aria-invalid", "false")
    expect(input).not.toHaveAttribute("aria-describedby")
    expect(screen.queryByText(message)).not.toBeInTheDocument()
    await user.click(input)
    await user.tab()
    expect(input).toHaveAttribute("aria-invalid", "true")
    expect(input).toHaveAccessibleDescription(message)
    expect(document.getElementById(input.getAttribute("aria-describedby")!)).toBeVisible()
    fireEvent.change(input, { target: { value: "09:00" } })
    expect(screen.queryByText(message)).not.toBeInTheDocument()
    expect(input).toHaveAttribute("aria-invalid", "false")
    expect(input).not.toHaveAttribute("aria-describedby")
  })

  it("shows quantity errors after blur before submit and clears them when corrected", async () => {
    const user = await renderVisualTab()
    await user.click(screen.getByRole("tab", { name: i18n.t("rentals.resources.sheetTabs.basic") }))
    await user.click(screen.getByRole("radio", { name: i18n.t("rentals.resources.typeGood") }))
    const input = screen.getByRole("spinbutton", { name: i18n.t("rentals.resources.form.totalQuantity") })
    const message = i18n.t("rentals.resources.validation.quantityMin")
    await user.clear(input)
    expect(input).toHaveAttribute("aria-invalid", "false")
    expect(input).not.toHaveAttribute("aria-describedby")
    await user.tab()
    expect(input).toHaveAttribute("aria-invalid", "true")
    expect(input).toHaveAccessibleDescription(message)
    expect(document.getElementById(input.getAttribute("aria-describedby")!)).toBeVisible()
    await user.type(input, "2")
    expect(screen.queryByText(message)).not.toBeInTheDocument()
    expect(input).toHaveAttribute("aria-invalid", "false")
    expect(input).not.toHaveAttribute("aria-describedby")
  })

  it.each([
    ["pt-BR", "Informe um número inteiro entre 1 e 100000."],
    ["en", "Enter a whole number between 1 and 100000."],
    ["es", "Indique un número entero entre 1 y 100000."],
  ])("rejects invalid capacity beside the field in %s", async (locale, message) => {
    await i18n.changeLanguage(locale)
    try {
      const user = await renderVisualTab()
      const input = screen.getByRole("spinbutton", { name: i18n.t("resourceVisual.capacityPeople") })
      expect(screen.queryByText(message)).not.toBeInTheDocument()
      for (const value of ["0", "-1", "1.5", "999999"]) {
        await user.clear(input)
        await user.type(input, value)
        await user.tab()
        expect(input.closest('[data-slot="form-item"]')).toHaveTextContent(message)
        expect(input).toHaveAttribute("aria-invalid", "true")
        expect(input).toHaveAccessibleDescription(message)
        expect(input).toHaveClass("aria-invalid:border-destructive")
        expect(screen.getByRole("button", { name: i18n.t("rentals.resources.saveCreate") })).toBeDisabled()
      }
      for (const value of ["1", "100000", ""]) {
        await user.clear(input)
        if (value) await user.type(input, value)
        await user.tab()
        expect(screen.queryByText(message)).not.toBeInTheDocument()
        expect(input).toHaveAttribute("aria-invalid", "false")
      }
    } finally {
      await i18n.changeLanguage("pt-BR")
    }
  })

  it("reveals a blank add-resource name beside the field with an invalid border after blur", async () => {
    const user = await renderVisualTab()
    await user.click(screen.getByRole("tab", { name: i18n.t("rentals.resources.sheetTabs.basic") }))
    const name = screen.getByRole("textbox", { name: i18n.t("rentals.resources.form.name") })
    const message = i18n.t("rentals.resources.validation.nameRequired")
    expect(screen.queryByText(message)).not.toBeInTheDocument()
    await user.click(name)
    await user.tab()
    expect(name.closest('[data-slot="form-item"]')).toHaveTextContent(message)
    expect(name).toHaveAccessibleDescription(message)
    expect(name).toHaveAttribute("aria-invalid", "true")
    expect(name).toHaveClass("aria-invalid:border-destructive")
    await user.type(name, "Sala de reunião")
    expect(screen.queryByText(message)).not.toBeInTheDocument()
    expect(name).toHaveAttribute("aria-invalid", "false")
  })

  it("reveals template errors when the template control is blurred before submit", async () => {
    const user = await renderVisualTab()
    const select = screen.getByRole("combobox", { name: i18n.t("resourceVisual.pickerTitle") })
    await user.click(select)
    await user.click(await screen.findByRole("option", { name: "Fixture template" }))
    fireEvent.blur(select)
    expect(select.closest('[data-slot="form-item"]')).toHaveTextContent("Template fixture error")
    expect(select).toHaveAttribute("aria-invalid", "true")
    expect(select).toHaveAccessibleDescription(expect.stringContaining("Template fixture error"))
  })
})
