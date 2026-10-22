import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { toast } from "sonner"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { ResourceVisualCatalogPage } from "@/features/admin/pages/ResourceVisualCatalogPage"
import { getTenantSegments, listAdminVisualTemplates, listVisualTags, saveVisualTag } from "@/features/rentals/services/resourceVisualService"

vi.mock("@/features/rentals/services/resourceVisualService", () => ({
  archiveVisualTemplate: vi.fn(), deleteVisualTag: vi.fn(), getTenantSegments: vi.fn(), listAdminVisualTemplates: vi.fn(),
  listVisualRevisions: vi.fn(), listVisualTags: vi.fn(), publishVisualRevision: vi.fn(), replaceTenantSegments: vi.fn(),
  saveVisualRevision: vi.fn(), saveVisualTag: vi.fn(), saveVisualTemplate: vi.fn(),
}))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

describe("ResourceVisualCatalogPage tag creation", () => {
  beforeEach(() => {
    vi.mocked(listAdminVisualTemplates).mockReset().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 30, filterSemantics: "all" })
    vi.mocked(listVisualTags).mockReset().mockResolvedValue([])
    vi.mocked(getTenantSegments).mockReset()
    vi.mocked(saveVisualTag).mockReset()
    vi.mocked(toast.success).mockReset()
    vi.mocked(toast.error).mockReset()
  })

  it("posts the tag, clears inputs and shows a success toast only after success", async () => {
    const user = userEvent.setup()
    vi.mocked(saveVisualTag).mockResolvedValue({ id: "3f2a9c1e-7b4d-1a2b-ff00-9c8d7e6f5a4b", slug: "padel", kind: "Segment", facet: "segment", nameI18n: {}, isActive: true, sortOrder: 0 })
    render(<ResourceVisualCatalogPage />)
    const name = await screen.findByPlaceholderText("Nome")
    const slug = screen.getByPlaceholderText("Identificador")
    await user.type(name, "Padel")
    await user.type(slug, "padel")
    const button = screen.getByRole("button", { name: "Adicionar" })
    expect(button).toHaveAttribute("type", "button")
    await user.click(button)

    await waitFor(() => expect(saveVisualTag).toHaveBeenCalledWith(expect.objectContaining({ slug: "padel", kind: "Segment" })))
    expect(toast.success).toHaveBeenCalledWith("Alterações salvas.")
    expect(name).toHaveValue("")
    expect(slug).toHaveValue("")
  })

  it("shows errors and retains inputs when saving fails; validates empty values", async () => {
    const user = userEvent.setup()
    vi.mocked(saveVisualTag).mockRejectedValue(new Error("Falha ao salvar"))
    render(<ResourceVisualCatalogPage />)
    const name = await screen.findByPlaceholderText("Nome")
    const slug = screen.getByPlaceholderText("Identificador")
    await user.type(name, "Padel")
    await user.type(slug, "padel")
    await user.click(screen.getByRole("button", { name: "Adicionar" }))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Falha ao salvar"))
    expect(name).toHaveValue("Padel")
    expect(slug).toHaveValue("padel")
    await user.clear(name)
    await user.click(screen.getByRole("button", { name: "Adicionar" }))
    expect(saveVisualTag).toHaveBeenCalledTimes(1)
    expect(toast.error).toHaveBeenCalledWith("Informe o nome e o identificador.")
  })
})
