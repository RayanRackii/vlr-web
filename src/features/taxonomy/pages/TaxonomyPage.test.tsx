import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { TaxonomyPage } from "@/features/taxonomy/pages/TaxonomyPage"
import { TestPermissionProvider } from "@/features/users/permissions/PermissionContext"
import i18n from "@/lib/i18n"

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

vi.mock("@/features/taxonomy/services/taxonomyService", () => ({
  listTaxonomyCategories: vi.fn(),
  listTaxonomyTags: vi.fn(),
  deleteTaxonomyCategory: vi.fn(),
  deleteTaxonomyTag: vi.fn(),
  createTaxonomyCategory: vi.fn(),
  createTaxonomyTag: vi.fn(),
  updateTaxonomyCategory: vi.fn(),
  updateTaxonomyTag: vi.fn(),
}))

import { deleteTaxonomyCategory, listTaxonomyCategories, listTaxonomyTags } from "@/features/taxonomy/services/taxonomyService"

const category = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Equipamento",
  slug: "equipamento",
  parentId: null,
  icon: null,
  sortOrder: 0,
}

describe("TaxonomyPage delete", () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    await i18n.changeLanguage("pt-BR")
    vi.mocked(listTaxonomyCategories).mockResolvedValue([category])
    vi.mocked(listTaxonomyTags).mockResolvedValue([])
    vi.mocked(deleteTaxonomyCategory).mockResolvedValue()
  })

  it("asks in the app before deleting a category and stays when cancelled", async () => {
    const confirm = vi.spyOn(window, "confirm")
    const user = userEvent.setup()
    render(
      <TestPermissionProvider permissions={["core.taxonomy.manage"]}>
        <TaxonomyPage />
      </TestPermissionProvider>,
    )
    await user.click(await screen.findByRole("button", { name: "Excluir" }))
    const dialog = await screen.findByRole("dialog", { name: i18n.t("common.delete") })
    expect(dialog).toHaveTextContent(i18n.t("taxonomy.deleteConfirm", { name: category.name }))
    expect(confirm).not.toHaveBeenCalled()
    await user.click(within(dialog).getByRole("button", { name: i18n.t("common.cancel") }))
    expect(deleteTaxonomyCategory).not.toHaveBeenCalled()
    expect(screen.getAllByText(category.name).length).toBeGreaterThan(0)
    await user.click(screen.getByRole("button", { name: "Excluir" }))
    await user.click(within(await screen.findByRole("dialog", { name: i18n.t("common.delete") })).getByRole("button", { name: i18n.t("common.delete") }))
    expect(deleteTaxonomyCategory).toHaveBeenCalledExactlyOnceWith(category.id)
    confirm.mockRestore()
  })
})
