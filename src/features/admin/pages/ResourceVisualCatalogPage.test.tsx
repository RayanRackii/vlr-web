import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { ResourceVisualCatalogPage } from "@/features/admin/pages/ResourceVisualCatalogPage"
import { getTenantSegments, listAdminVisualTemplates, listVisualRevisions, listVisualTags, replaceTenantSegments, saveVisualTag, saveVisualTemplate } from "@/features/rentals/services/resourceVisualService"

vi.mock("@/features/rentals/services/resourceVisualService", () => ({
  archiveVisualTemplate: vi.fn(), deleteVisualTag: vi.fn(), getTenantSegments: vi.fn(), listAdminVisualTemplates: vi.fn(),
  listVisualRevisions: vi.fn(), listVisualTags: vi.fn(), publishVisualRevision: vi.fn(), replaceTenantSegments: vi.fn(),
  saveVisualRevision: vi.fn(), saveVisualTag: vi.fn(), saveVisualTemplate: vi.fn(),
}))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

function TenantCatalogHarness() {
  const navigate = useNavigate()

  return <><button type="button" onClick={() => navigate("/admin/tenants/tenant-2/recursos-visuais")}>Trocar tenant</button><Routes><Route path="/admin/tenants/:id/recursos-visuais" element={<ResourceVisualCatalogPage />} /></Routes></>
}

describe("ResourceVisualCatalogPage tag creation", () => {
  beforeEach(() => {
    vi.mocked(listAdminVisualTemplates).mockReset().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 30, filterSemantics: "all" })
    vi.mocked(listVisualTags).mockReset().mockResolvedValue([])
    vi.mocked(listVisualRevisions).mockReset().mockResolvedValue([])
    vi.mocked(getTenantSegments).mockReset()
    vi.mocked(saveVisualTag).mockReset()
    vi.mocked(saveVisualTemplate).mockReset()
    vi.mocked(replaceTenantSegments).mockReset()
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

  it("loads a selected template into the edit form, including its tags, and can cancel", async () => {
    const user = userEvent.setup()
    vi.mocked(listAdminVisualTemplates).mockResolvedValue({
      items: [{ id: "3f2a9c1e-7b4d-1a2b-ff00-9c8d7e6f5a4b", slug: "padel", nameI18n: { "pt-BR": "Padel" }, descriptionI18n: { "pt-BR": "Quadra" }, isActive: true, sortOrder: 0, version: 1, tags: [{ id: "5f2a9c1e-7b4d-1a2b-ff00-9c8d7e6f5a4b", slug: "sport", kind: "Segment", facet: "segment", nameI18n: { "pt-BR": "Esporte" }, isActive: true, sortOrder: 0 }], publishedRevision: null }], total: 1, page: 1, pageSize: 30, filterSemantics: "all" })
    vi.mocked(listVisualTags).mockResolvedValue([{ id: "5f2a9c1e-7b4d-1a2b-ff00-9c8d7e6f5a4b", slug: "sport", kind: "Segment", facet: "segment", nameI18n: { "pt-BR": "Esporte" }, isActive: true, sortOrder: 0 }])
    render(<ResourceVisualCatalogPage />)

    await user.click(await screen.findByRole("button", { name: /Padel/ }))
    expect(screen.getByRole("heading", { name: "Editar modelo" })).toBeInTheDocument()
    expect(screen.getByDisplayValue("padel")).toBeInTheDocument()
    expect(screen.getByLabelText("Esporte")).toBeChecked()
    await user.click(screen.getByText("Nova revisão"))
    expect(screen.getByLabelText("Aspect ratio")).toHaveValue("1.6667")
    expect(screen.getByLabelText("Color")).toHaveValue("#4D6A92")
    await user.click(screen.getByRole("button", { name: "Cancelar edição" }))
    expect(screen.getByRole("heading", { name: "Novo modelo" })).toBeInTheDocument()
  })

  it("keeps saved tenant segments and confirms success", async () => {
    const user = userEvent.setup()
    const segment = { id: "5f2a9c1e-7b4d-1a2b-ff00-9c8d7e6f5a4b", slug: "sport", kind: "Segment" as const, facet: "segment", nameI18n: { "pt-BR": "Esporte" }, isActive: true, sortOrder: 0 }
    vi.mocked(listVisualTags).mockResolvedValue([segment])
    vi.mocked(getTenantSegments).mockResolvedValue([])
    vi.mocked(replaceTenantSegments).mockResolvedValue([segment])
    render(<MemoryRouter initialEntries={["/admin/tenants/tenant-1/recursos-visuais"]}><Routes><Route path="/admin/tenants/:id/recursos-visuais" element={<ResourceVisualCatalogPage />} /></Routes></MemoryRouter>)

    await user.click(await screen.findByLabelText("Esporte"))
    await user.click(screen.getByRole("button", { name: "Salvar" }))
    await waitFor(() => expect(replaceTenantSegments).toHaveBeenCalledWith("tenant-1", [segment.id]))
    expect(toast.success).toHaveBeenCalledWith("Alterações salvas.")
    expect(screen.getByLabelText("Esporte")).toBeChecked()
  })

  it("resets dirty segment selection when changing tenants", async () => {
    const user = userEvent.setup()
    const first = { id: "segment-1", slug: "first", kind: "Segment" as const, facet: "segment", nameI18n: { "pt-BR": "Primeiro" }, isActive: true, sortOrder: 0 }
    const second = { id: "segment-2", slug: "second", kind: "Segment" as const, facet: "segment", nameI18n: { "pt-BR": "Segundo" }, isActive: true, sortOrder: 0 }
    vi.mocked(listVisualTags).mockResolvedValue([first, second])
    vi.mocked(getTenantSegments).mockImplementation(async (tenantId) => tenantId === "tenant-1" ? [] : [second])
    render(<MemoryRouter initialEntries={["/admin/tenants/tenant-1/recursos-visuais"]}><TenantCatalogHarness /></MemoryRouter>)

    await user.click(await screen.findByLabelText("Primeiro"))
    await user.click(screen.getByRole("button", { name: "Trocar tenant" }))

    expect(await screen.findByLabelText("Segundo")).toBeChecked()
    expect(screen.getByLabelText("Primeiro")).not.toBeChecked()
  })

  it("ignores a stale segment response after changing tenants", async () => {
    const user = userEvent.setup()
    const first = { id: "segment-1", slug: "first", kind: "Segment" as const, facet: "segment", nameI18n: { "pt-BR": "Primeiro" }, isActive: true, sortOrder: 0 }
    const second = { id: "segment-2", slug: "second", kind: "Segment" as const, facet: "segment", nameI18n: { "pt-BR": "Segundo" }, isActive: true, sortOrder: 0 }
    let resolveFirst: ((value: (typeof first)[]) => void) | undefined
    const firstSegments = new Promise<(typeof first)[]>((resolve) => { resolveFirst = resolve })
    vi.mocked(listVisualTags).mockResolvedValue([first, second])
    vi.mocked(getTenantSegments).mockImplementation(async (tenantId) => tenantId === "tenant-1" ? firstSegments : [second])
    render(<MemoryRouter initialEntries={["/admin/tenants/tenant-1/recursos-visuais"]}><TenantCatalogHarness /></MemoryRouter>)

    await user.click(screen.getByRole("button", { name: "Trocar tenant" }))
    expect(await screen.findByLabelText("Segundo")).toBeChecked()
    resolveFirst?.([first])

    await waitFor(() => expect(screen.getByLabelText("Segundo")).toBeChecked())
    expect(screen.getByLabelText("Primeiro")).not.toBeChecked()
  })
})
