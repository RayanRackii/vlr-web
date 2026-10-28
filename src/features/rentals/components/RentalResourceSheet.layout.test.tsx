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

import { RentalResourceSheet } from "@/features/rentals/components/RentalResourceSheet"
import { TestPermissionProvider } from "@/features/users/permissions/PermissionContext"
import { listPickerTags, listVisualTemplates } from "@/features/rentals/services/resourceVisualService"
import { visualPageSchema, visualTagSchema } from "@/features/rentals/schemas/resourceVisualSchemas"
import templateFixture from "@/features/rentals/schemas/__fixtures__/admin-visual-templates.json"
import tagFixture from "@/features/rentals/schemas/__fixtures__/visual-tags.json"
import i18n from "@/lib/i18n"

const id = "11111111-1111-1111-1111-111111111111"

function renderSheet(overrides: Partial<ComponentProps<typeof RentalResourceSheet>> = {}) {
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
        {...overrides}
      />
    </TestPermissionProvider>,
  )
}

describe("RentalResourceSheet tabs layout", () => {
  beforeEach(() => {
    vi.mocked(listVisualTemplates).mockResolvedValue({ ...visualPageSchema.parse(templateFixture), items: [] })
    vi.mocked(listPickerTags).mockResolvedValue([])
  })

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
    const css = readFileSync("src/features/rentals/components/rentalResources.css", "utf8")
    expect(css).toMatch(/\.rental-resource-sheet \.resource-editor-tab-list\s*\{[^}]*overflow-y:\s*hidden/)
    expect(css).toMatch(/\.rental-resource-sheet \.resource-editor-tab-list\s*\{[^}]*scrollbar-width:\s*none/)
    expect(css).toMatch(/\.resource-editor-tab-list::-webkit-scrollbar\s*\{[^}]*display:\s*none/)

    for (const trigger of screen.getAllByRole("tab")) {
      expect(trigger.className).toContain("whitespace-nowrap")
    }
  })

  it("lets keyboard users switch tabs and cancel from the persistent footer", async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    renderSheet({ onOpenChange })
    const basic = screen.getByRole("tab", { name: "Básico" })
    basic.focus()
    await user.keyboard("{ArrowRight}{Enter}")
    expect(screen.getByRole("tab", { name: "Preço e regras" })).toHaveAttribute("aria-selected", "true")
    expect(screen.getByRole("switch", { name: i18n.t("rentals.resources.form.requiresDeposit") })).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: i18n.t("common.cancel") }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
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
    renderSheet()
    await user.click(screen.getByRole("tab", { name: "Visual" }))
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
    renderSheet()
    await user.click(screen.getByRole("tab", { name: "Visual" }))
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
    renderSheet({ readOnly: true })
    await user.click(screen.getByRole("tab", { name: "Visual" }))
    const grid = await screen.findByRole("group", { name: i18n.t("resourceVisual.pickerTitle") })
    for (const card of within(grid).getAllByRole("button")) expect(card).toBeDisabled()
  })
})
