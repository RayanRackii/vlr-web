import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { ResourceTypeWizardPage } from "@/features/assets/pages/ResourceTypeWizardPage"

const createResourceType = vi.fn()
const updateResourceType = vi.fn()
const getResourceType = vi.fn()

vi.mock("@/features/assets/resourceTypes/resourceTypesService", () => ({
  createResourceType: (...args: unknown[]) => createResourceType(...args),
  updateResourceType: (...args: unknown[]) => updateResourceType(...args),
  getResourceType: (...args: unknown[]) => getResourceType(...args),
}))

function renderWizard() {
  return render(
    <MemoryRouter initialEntries={["/ativos/tipos/novo"]}>
      <Routes>
        <Route path="/ativos/tipos/novo" element={<ResourceTypeWizardPage />} />
        <Route path="/ativos/tipos" element={<p>lista de tipos</p>} />
        <Route path="/ativos/categorias" element={<p>categorias antigas</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe("ResourceTypeWizardPage", () => {
  beforeEach(() => {
    createResourceType.mockReset()
    updateResourceType.mockReset()
    getResourceType.mockReset()
    createResourceType.mockResolvedValue({ id: "11111111-1111-4111-8111-111111111111" })
  })

  it("walks the numbered steps, hides internal fields, and saves the type", async () => {
    const user = userEvent.setup()
    renderWizard()
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1)
    expect(document.querySelector('[aria-current="step"]')).toHaveTextContent("Nome e vocabulário")
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Continuar" }))
    expect(screen.getByRole("alert")).toHaveTextContent("Nome do tipo")
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Nome do tipo" })).toHaveFocus())

    await user.type(screen.getByRole("textbox", { name: "Nome do tipo" }), "Profissional")
    await user.type(screen.getByRole("textbox", { name: "Como o cliente fala de um" }), "profissional")
    await user.type(screen.getByRole("textbox", { name: "Como o cliente fala de vários" }), "profissionais")
    await user.click(screen.getByRole("radio", { name: "uma" }))
    expect(screen.getByLabelText("O que o cliente vê")).toHaveTextContent("Escolha uma profissional")

    await user.click(screen.getByRole("button", { name: "Continuar" }))
    await user.click(screen.getByRole("checkbox", { name: "Reservável por horário" }))
    expect(screen.getByText("Mudar uma capacidade não apaga reservas já feitas.")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Continuar" }))
    await user.click(screen.getByRole("button", { name: "Adicionar campo" }))
    await user.type(screen.getByRole("textbox", { name: "Nome do campo" }), "Comissão interna")
    await user.click(screen.getByRole("button", { name: "Interno" }))
    await user.click(screen.getByRole("button", { name: "Adicionar campo" }))
    const names = screen.getAllByRole("textbox", { name: "Nome do campo" })
    await user.type(names[1]!, "Especialidade")
    const ask = screen.getAllByRole("checkbox", { name: "Perguntar na reserva" })
    await user.click(ask[1]!)

    const preview = screen.getByLabelText("O que o cliente vê")
    expect(preview).toHaveTextContent("Especialidade")
    expect(preview).not.toHaveTextContent("Comissão")
    expect(preview).toHaveTextContent("1 campo interno fica oculto do cliente.")

    await user.click(screen.getByRole("button", { name: "Continuar" }))
    await user.click(screen.getByRole("button", { name: "Salvar" }))
    expect(await screen.findByText("lista de tipos")).toBeInTheDocument()
    expect(createResourceType).toHaveBeenCalledWith(expect.objectContaining({
      name: "Profissional",
      article: "uma",
      capabilities: { bookable: true, deliverable: false, maintenance: false },
      fields: [
        expect.objectContaining({ name: "Comissão interna", visibility: "internal", filterable: false, askOnBooking: false }),
        expect.objectContaining({ name: "Especialidade", visibility: "public", askOnBooking: true }),
      ],
    }))
    expect(getResourceType).not.toHaveBeenCalled()
  })

  it("keeps entered values when going back and shows a submit error on the review step", async () => {
    const user = userEvent.setup()
    createResourceType.mockRejectedValue(new Error("Falha de rede"))
    renderWizard()
    await user.type(screen.getByRole("textbox", { name: "Nome do tipo" }), "Quadra")
    await user.type(screen.getByRole("textbox", { name: "Como o cliente fala de um" }), "quadra")
    await user.type(screen.getByRole("textbox", { name: "Como o cliente fala de vários" }), "quadras")
    await user.click(screen.getByRole("button", { name: "Continuar" }))
    await user.click(screen.getByRole("button", { name: "Voltar" }))
    expect(screen.getByRole("textbox", { name: "Nome do tipo" })).toHaveValue("Quadra")

    await user.click(screen.getByRole("button", { name: "Continuar" }))
    await user.click(screen.getByRole("button", { name: "Continuar" }))
    await user.click(screen.getByRole("button", { name: "Continuar" }))
    await user.click(screen.getByRole("button", { name: "Salvar" }))
    expect(await screen.findByText("Falha de rede")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Salvar" })).toBeEnabled()
    expect(screen.queryByText("lista de tipos")).not.toBeInTheDocument()
  })

  it("advances with Enter and focuses the first invalid field after Next", async () => {
    const user = userEvent.setup()
    renderWizard()
    await user.type(screen.getByRole("textbox", { name: "Nome do tipo" }), "Quadra{Enter}")
    expect(screen.getByRole("alert")).toHaveTextContent("Como o cliente fala de um")
    await user.type(screen.getByRole("textbox", { name: "Como o cliente fala de um" }), "quadra")
    await user.type(screen.getByRole("textbox", { name: "Como o cliente fala de vários" }), "quadras{Enter}")
    expect(screen.getByRole("checkbox", { name: "Reservável por horário" })).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Continuar" }))
    await user.click(screen.getByRole("button", { name: "Adicionar campo" }))
    await user.click(screen.getByRole("button", { name: "Continuar" }))
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Nome do campo" })).toHaveFocus())
    await user.type(screen.getByRole("textbox", { name: "Nome do campo" }), "Cor")
  })
})
