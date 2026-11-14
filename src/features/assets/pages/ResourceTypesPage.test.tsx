import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { ResourceTypesPage } from "@/features/assets/pages/ResourceTypesPage"
import { TestPermissionProvider } from "@/features/users/permissions/PermissionContext"

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

function renderPage(permissions = ["inventory.categories.read", "inventory.categories.write"]) {
  return render(
    <TestPermissionProvider permissions={permissions} activeModules={["inventory"]}>
      <MemoryRouter>
        <ResourceTypesPage />
      </MemoryRouter>
    </TestPermissionProvider>,
  )
}

const table = () => screen.getByRole("table")
const cards = () => screen.getByRole("list", { name: "Tipos de recurso" })

describe("ResourceTypesPage", () => {
  beforeEach(() => {
    listResourceTypes.mockReset()
    listResourceTypes.mockResolvedValue(records)
  })

  it("lists seeded and company types in table columns without opening an editor", async () => {
    renderPage()
    expect(screen.getByRole("status", { name: /Carregando/ })).toBeInTheDocument()
    expect(await within(await screen.findByRole("table")).findByText("Quadra")).toBeInTheDocument()
    expect(within(table()).getAllByRole("columnheader").map((h) => h.textContent)).toEqual([
      "Tipo",
      "Capacidades",
      "Recursos",
      "Ações",
    ])
    expect(screen.getByRole("heading", { level: 1, name: "Tipos de recurso" })).toBeInTheDocument()
    expect(within(table()).getByText("Semeado")).toBeInTheDocument()
    expect(within(table()).getByText(/vem pronto com a Rolvix/)).toBeInTheDocument()
    expect(within(table()).getByText("Da empresa")).toBeInTheDocument()
    expect(within(table()).getByText("2 recursos")).toBeInTheDocument()
    expect(within(table()).getAllByText("Por horário")).toHaveLength(2)
    expect(screen.getByRole("link", { name: "Novo tipo" })).toHaveAttribute("href", "/ativos/tipos/novo")
    expect(within(table()).getByRole("link", { name: "Quadra" })).toHaveAttribute(
      "href",
      "/ativos/tipos/11111111-1111-4111-8111-111111111111",
    )
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("keeps the edit action in the row menu", async () => {
    const user = userEvent.setup()
    renderPage()
    await within(await screen.findByRole("table")).findByText("Quadra")
    await user.click(within(table()).getByRole("button", { name: "Ações de Profissional" }))
    expect(await screen.findByRole("menuitem", { name: "Editar" })).toHaveAttribute(
      "href",
      "/ativos/tipos/22222222-2222-4222-8222-222222222222",
    )
  })

  it("hides new and edit without permission to change types", async () => {
    renderPage(["inventory.categories.read"])
    await within(await screen.findByRole("table")).findByText("Quadra")
    expect(screen.queryByRole("link", { name: "Novo tipo" })).not.toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "Quadra" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /^Ações de/ })).not.toBeInTheDocument()
    expect(within(table()).getAllByRole("columnheader")).toHaveLength(3)
  })

  it("filters by capability chip and toggles it back to all", async () => {
    const user = userEvent.setup()
    renderPage()
    await within(await screen.findByRole("table")).findByText("Profissional")
    const group = screen.getByRole("group", { name: "Capacidade" })
    await user.click(within(group).getByRole("button", { name: "Manutenção" }))
    expect(within(table()).getByText("Quadra")).toBeInTheDocument()
    expect(within(table()).queryByText("Profissional")).not.toBeInTheDocument()
    await user.click(within(group).getByRole("button", { name: "Todos" }))
    expect(within(table()).getByText("Profissional")).toBeInTheDocument()
  })

  it("filters by search and shows the empty state", async () => {
    const user = userEvent.setup()
    renderPage()
    await within(await screen.findByRole("table")).findByText("Quadra")
    const search = screen.getByRole("searchbox", { name: "Buscar tipo" })
    await user.type(search, "profissionais")
    expect(within(table()).queryByText("Quadra")).not.toBeInTheDocument()
    expect(within(table()).getByText("Profissional")).toBeInTheDocument()
    await user.clear(search)
    await user.type(search, "zzz")
    expect(await screen.findByText("Nenhum tipo encontrado.")).toBeInTheDocument()
  })

  it("renders cards below md with the same data", async () => {
    renderPage()
    await within(await screen.findByRole("table")).findByText("Quadra")
    const items = within(cards()).getAllByRole("listitem")
    expect(items).toHaveLength(2)
    expect(within(items[0]).getByText("Quadra")).toBeInTheDocument()
    expect(within(items[0]).getByRole("button", { name: "Ações de Quadra" })).toBeInTheDocument()
    expect(within(items[1]).getByText("3 recursos")).toBeInTheDocument()
  })

  it("shows the load error with a retry that reloads", async () => {
    const user = userEvent.setup()
    let failing = true
    listResourceTypes.mockImplementation(() => (failing ? Promise.reject(new Error("boom")) : Promise.resolve(records)))
    renderPage()
    expect(await screen.findByRole("alert")).toHaveTextContent("boom")
    failing = false
    await user.click(await screen.findByRole("button", { name: "Tentar novamente" }))
    expect(await within(await screen.findByRole("table")).findByText("Quadra")).toBeInTheDocument()
  })
})
