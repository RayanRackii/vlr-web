import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { ResourceVisualCatalogPage } from "@/features/admin/pages/ResourceVisualCatalogPage"
import { getAdminTenant } from "@/features/admin/services/adminTenantsService"
import { getTenantSegments, listAdminVisualTemplates, listVisualRevisions, listVisualTags, replaceTenantSegments, saveVisualTag, saveVisualTemplate } from "@/features/rentals/services/resourceVisualService"
import apiTemplates from "@/features/rentals/schemas/__fixtures__/admin-visual-templates.json"
import { visualPageSchema } from "@/features/rentals/schemas/resourceVisualSchemas"

vi.mock("@/features/admin/services/adminTenantsService", () => ({ getAdminTenant: vi.fn() }))

vi.mock("@/features/rentals/services/resourceVisualService", () => ({
  archiveVisualTemplate: vi.fn(), deleteVisualTag: vi.fn(), getTenantSegments: vi.fn(), listAdminVisualTemplates: vi.fn(),
  listVisualRevisions: vi.fn(), listVisualTags: vi.fn(), publishVisualRevision: vi.fn(), replaceTenantSegments: vi.fn(),
  saveVisualRevision: vi.fn(), saveVisualTag: vi.fn(), saveVisualTemplate: vi.fn(), visualArtUrl: (id: string) => `/art/${id}.svg`,
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
    vi.mocked(getAdminTenant).mockReset().mockResolvedValue({ id: "11111111-1111-4111-8111-111111111111", legalName: "FICC", taxId: "1", subdomain: "ficc", isActive: true, createdAt: "2026-01-01", activeModules: [], assetFamilyKeys: [] })
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
    await user.clear(slug)
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
    await user.clear(slug)
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

  it("generates the tag slug until it is edited manually and keeps one new-template action", async () => {
    const user = userEvent.setup()
    render(<ResourceVisualCatalogPage />)

    await screen.findByPlaceholderText("Nome")
    const name = screen.getAllByLabelText("Nome")[1]!
    const slug = screen.getAllByLabelText("Identificador")[1]!
    await user.type(name, "Pádel coberto")
    expect(slug).toHaveValue("padel-coberto")

    await user.clear(slug)
    await user.type(slug, "meu-modelo")
    await user.type(name, " premium")
    expect(slug).toHaveValue("meu-modelo")
    expect(screen.getAllByRole("button", { name: "Novo modelo" })).toHaveLength(1)
  })

  it("renders an API-shaped template card that opens the edit form with status and publish action", async () => {
    const user = userEvent.setup()
    const apiTemplate = visualPageSchema.parse(apiTemplates).items[0]
    vi.mocked(listAdminVisualTemplates).mockResolvedValue({ ...visualPageSchema.parse(apiTemplates), items: [{ ...apiTemplate!, publishedRevision: null }] })
    vi.mocked(listVisualTags).mockResolvedValue(apiTemplate?.tags ?? [])
    render(<ResourceVisualCatalogPage />)

    const card = await screen.findByRole("button", { name: /Quadra de padel/ })
    await user.click(card)
    expect(screen.getByRole("heading", { name: "Editar modelo" })).toBeInTheDocument()
    expect(card).toHaveAttribute("aria-pressed", "true")
    expect(card).toHaveClass("border-primary")
    expect(screen.getByDisplayValue("Quadra de padel")).toHaveFocus()
    expect(screen.getAllByText("Sem revisão publicada")).toHaveLength(2)
    expect(screen.getByRole("button", { name: "Publicar" })).toBeInTheDocument()
    await user.click(screen.getByText("Nova revisão"))
    expect(screen.getByLabelText("Aspect ratio")).toHaveValue("1.6667")
    expect(screen.getByLabelText("Color")).toHaveValue("#4D6A92")
    await user.click(screen.getByRole("button", { name: "Cancelar edição" }))
    expect(screen.getByRole("heading", { name: "Novo modelo" })).toBeInTheDocument()
  })

  it("opens the edit form and reports revision-list failures", async () => {
    const user = userEvent.setup()
    const apiTemplate = visualPageSchema.parse(apiTemplates).items[0]
    vi.mocked(listAdminVisualTemplates).mockResolvedValue({
      ...visualPageSchema.parse(apiTemplates),
      items: [apiTemplate!],
    })
    vi.mocked(listVisualRevisions).mockRejectedValue(new Error("Revision load failed"))
    render(<ResourceVisualCatalogPage />)

    await user.click(await screen.findByRole("button", { name: /Quadra de padel/ }))

    expect(screen.getByRole("heading", { name: "Editar modelo" })).toBeInTheDocument()
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Revision load failed"))
  })

  it("keeps saved tenant segments and confirms success", async () => {
    const user = userEvent.setup()
    const segment = { id: "5f2a9c1e-7b4d-1a2b-ff00-9c8d7e6f5a4b", slug: "sport", kind: "Segment" as const, facet: "segment", nameI18n: { "pt-BR": "Esporte" }, isActive: true, sortOrder: 0 }
    vi.mocked(listVisualTags).mockResolvedValue([segment])
    vi.mocked(getTenantSegments).mockResolvedValue([])
    vi.mocked(replaceTenantSegments).mockResolvedValue([segment])
    render(<MemoryRouter initialEntries={["/admin/tenants/tenant-1/recursos-visuais"]}><Routes><Route path="/admin/tenants/:id/recursos-visuais" element={<ResourceVisualCatalogPage />} /></Routes></MemoryRouter>)

    expect(await screen.findByRole("heading", { name: "Segmentos do tenant: FICC" })).toBeInTheDocument()
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
