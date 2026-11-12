import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { ResourceTypesPage } from "@/features/assets/pages/ResourceTypesPage"

const listResourceTypes = vi.fn()

vi.mock("@/features/assets/resourceTypes/resourceTypesService", () => ({
  listResourceTypes: () => listResourceTypes(),
}))

const records = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    key: "quadra",
    name: "Quadra",
    singular: "quadra",
    plural: "quadras",
    article: "uma",
    seeded: true,
    resourceCount: 2,
    capabilities: { bookable: true, deliverable: false, maintenance: true },
    fields: [],
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    key: "profissional",
    name: "Profissional",
    singular: "profissional",
    plural: "profissionais",
    article: "um",
    seeded: false,
    resourceCount: 3,
    capabilities: { bookable: true, deliverable: false, maintenance: false },
    fields: [
      { key: "especialidade", type: "text", required: false, label: "Especialidade", visibility: "public" },
      { key: "comissao", type: "number", required: false, visibility: "internal" },
    ],
  },
]

function renderPage() {
  return render(
    <MemoryRouter>
      <ResourceTypesPage />
    </MemoryRouter>,
  )
}

describe("ResourceTypesPage", () => {
  beforeEach(() => {
    listResourceTypes.mockReset()
    listResourceTypes.mockResolvedValue(records)
  })

  it("lists seeded and company types without opening an editor", async () => {
    renderPage()
    expect(screen.getByRole("status")).toHaveTextContent("Carregando")
    expect(await screen.findByRole("heading", { name: "Quadra" })).toBeInTheDocument()
    expect(screen.getByText("Semeado")).toBeInTheDocument()
    expect(screen.getByText(/vem pronto com a Rolvix/)).toBeInTheDocument()
    expect(screen.getByText("Da empresa")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Novo tipo" })).toHaveAttribute("href", "/ativos/tipos/novo")
    expect(screen.getAllByRole("link", { name: "Editar" }).map((link) => link.getAttribute("href"))).toEqual([
      "/ativos/tipos/11111111-1111-4111-8111-111111111111",
      "/ativos/tipos/22222222-2222-4222-8222-222222222222",
    ])
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("filters by capability", async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole("heading", { name: "Profissional" })
    await user.click(screen.getByRole("button", { name: "Capacidade" }))
    await user.click(screen.getByRole("button", { name: "Manutenção" }))
    expect(screen.getByRole("heading", { name: "Quadra" })).toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: "Profissional" })).not.toBeInTheDocument()
  })
})
