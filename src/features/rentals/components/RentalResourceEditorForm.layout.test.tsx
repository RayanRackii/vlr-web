import type { ComponentProps } from "react"
import { readFileSync } from "node:fs"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

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

import { RentalResourceEditorForm } from "@/features/rentals/components/RentalResourceEditorForm"
import { TestPermissionProvider } from "@/features/users/permissions/PermissionContext"
import { listPickerTags, listVisualTemplates } from "@/features/rentals/services/resourceVisualService"
import { visualPageSchema, visualTagSchema } from "@/features/rentals/schemas/resourceVisualSchemas"
import templateFixture from "@/features/rentals/schemas/__fixtures__/admin-visual-templates.json"
import tagFixture from "@/features/rentals/schemas/__fixtures__/visual-tags.json"
import i18n from "@/lib/i18n"

const id = "11111111-1111-1111-1111-111111111111"

function renderEditor(overrides: Partial<ComponentProps<typeof RentalResourceEditorForm>> = {}) {
  return render(
    <TestPermissionProvider permissions={["rentals.assets.write"]}>
      <RentalResourceEditorForm
        onCancel={vi.fn()}
        editing={null}
        units={[{ id, tenantId: id, name: "Matriz", isActive: true }]}
        categories={[{ id, name: "Quadra" }]}
        families={[{ id, key: "spaces", label: "Espaços", fields: [], sortOrder: 0, isActive: true }]}
        busy={false}
        readOnly={false}
        onSubmit={vi.fn().mockResolvedValue(true)}
        {...overrides}
      />
    </TestPermissionProvider>,
  )
}

describe("RentalResourceEditorForm page layout", () => {
  beforeEach(() => {
    vi.mocked(listVisualTemplates).mockResolvedValue({ ...visualPageSchema.parse(templateFixture), items: [] })
    vi.mocked(listPickerTags).mockResolvedValue([])
  })

  it.each(["pt-BR", "en"])("renders translated editor labels in %s", async (locale) => {
    await i18n.changeLanguage(locale)
    try {
      renderEditor()
      expect(screen.getByRole("navigation", { name: i18n.t("rentals.resources.editor.breadcrumb") }).textContent).not.toContain("rentals.")
      expect(screen.getByRole("navigation", { name: i18n.t("rentals.resources.editor.sections") })).toHaveAccessibleName(locale === "en" ? "Resource sections" : "Seções do recurso")
      expect(document.body.textContent).not.toContain("rentals.resources.editor.")
    } finally { await i18n.changeLanguage("pt-BR") }
  })

  it("shows all modules together with jump buttons and no editor dialog", () => {
    renderEditor()
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    for (const name of ["Básico", "Preço e regras", "Visual"]) {
      expect(screen.getByRole("button", { name })).toHaveAttribute("aria-controls")
    }
    expect(screen.getByLabelText(i18n.t("rentals.resources.form.name"))).toBeVisible()
    expect(screen.getByRole("switch", { name: i18n.t("rentals.resources.form.requiresDeposit") })).toBeVisible()
    expect(screen.getByRole("spinbutton", { name: i18n.t("resourceVisual.capacityPeople") })).toBeVisible()
  })

  it("lets keyboard users jump to a module and cancel from the fixed footer", async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    renderEditor({ onCancel })
    const visual = screen.getByRole("button", { name: "Visual" })
    visual.focus()
    await user.keyboard("{Enter}")
    expect(document.getElementById(visual.getAttribute("aria-controls")!)).toHaveFocus()
    await user.click(screen.getAllByRole("button", { name: i18n.t("common.cancel") }).at(-1)!)
    expect(onCancel).toHaveBeenCalledWith()
    const css = readFileSync("src/features/rentals/components/rentalResources.css", "utf8")
    expect(css).toMatch(/\.resource-editor-footer\s*\{[^}]*position:\s*fixed/)
  })

  it("keeps every loaded template available and applies defaults from its preview card", async () => {
    const user = userEvent.setup()
    const page = visualPageSchema.parse(templateFixture)
    const template = page.items[0]!
    const revision = template.publishedRevision!
    vi.mocked(listVisualTemplates).mockResolvedValue({ ...page, items: Array.from({ length: 7 }, (_, index) => ({
      ...template, id: `template-${index}`, nameI18n: { "pt-BR": `Modelo ${index + 1}` },
      publishedRevision: { ...revision, id: `revision-${index}`, suggestedCapacityPeople: 8 },
    })) })
    renderEditor()
    await user.click(screen.getByRole("button", { name: "Visual" }))
    const grid = await screen.findByRole("group", { name: i18n.t("resourceVisual.pickerTitle") })
    expect(within(grid).getAllByRole("button")).toHaveLength(8)
    const card = within(grid).getByRole("button", { name: "Modelo 7" })
    await user.click(card)
    expect(card).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByRole("spinbutton", { name: i18n.t("resourceVisual.capacityPeople") })).toHaveValue(8)
    await user.click(within(grid).getByRole("button", { name: i18n.t("resourceVisual.noTemplate") }))
    expect(card).toHaveAttribute("aria-pressed", "false")
  })

  it("preserves search, segment scope and expandable tag filters", async () => {
    const user = userEvent.setup()
    const tag = visualTagSchema.parse(tagFixture[0])
    vi.mocked(listPickerTags).mockResolvedValue(Array.from({ length: 8 }, (_, index) => ({
      ...tag, id: `tag-${index}`, slug: `tag-${index}`, nameI18n: { "pt-BR": `Filtro ${index + 1}` },
    })))
    renderEditor()
    await user.click(screen.getByRole("button", { name: "Visual" }))
    await user.type(screen.getByRole("textbox", { name: i18n.t("resourceVisual.searchTemplates") }), "sala")
    await user.click(await screen.findByRole("button", { name: "Filtro 1" }))
    await user.click(screen.getByRole("button", { name: i18n.t("resourceVisual.seeAll") }))
    await waitFor(() => expect(listVisualTemplates).toHaveBeenLastCalledWith({ search: "sala", tagIds: ["tag-0"], allSegments: true }))
    expect(screen.queryByRole("button", { name: "Filtro 8" })).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: i18n.t("resourceVisual.showMoreTags", { count: 2 }) }))
    expect(screen.getByRole("button", { name: "Filtro 8" })).toBeInTheDocument()
  })

  it("keeps preview selection disabled for a read-only resource", async () => {
    const user = userEvent.setup()
    vi.mocked(listVisualTemplates).mockResolvedValue(visualPageSchema.parse(templateFixture))
    renderEditor({ readOnly: true })
    await user.click(screen.getByRole("button", { name: "Visual" }))
    const grid = await screen.findByRole("group", { name: i18n.t("resourceVisual.pickerTitle") })
    for (const card of within(grid).getAllByRole("button")) expect(card).toBeDisabled()
  })
})
