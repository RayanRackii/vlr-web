import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { createMemoryRouter, MemoryRouter, Route, RouterProvider, Routes, useLocation } from "react-router-dom"
import { beforeEach, expect, it, vi } from "vitest"

import { CadastroShell } from "./CadastroShell"
import { useStepSubmit, type StepSubmit } from "./stepSubmit"
import { useCadastroStep, type CadastroStep } from "./useCadastroStep"

const onBack = vi.fn()
const onPublish = vi.fn()

function Probe() {
  const location = useLocation()
  return <span data-testid="location">{`${location.pathname}${location.search}`}</span>
}

/** A step that registers a submit, like the W2 step components do. */
function SubmittingStep({ submit }: { submit: StepSubmit }) {
  const [value, setValue] = useState("")
  const driven = useStepSubmit(submit)
  return <div>
    <input aria-label="Campo" value={value} onChange={(event) => setValue(event.target.value)} />
    {driven ? null : <button type="button">Salvar passo</button>}
  </div>
}

function Page({ submit, done, canPublish = true, dirty = false, notApplicable }: { submit?: StepSubmit; done?: CadastroStep[]; canPublish?: boolean; dirty?: boolean; notApplicable?: CadastroStep[] }) {
  const { step, go } = useCadastroStep()
  return <CadastroShell kind="product" title="Diária" status={{ kind: "draft" }} step={step} go={go} dirty={dirty} busy={false} done={done} notApplicable={notApplicable} optional={["categorias"]} canPublish={canPublish} onPublish={onPublish} onBack={onBack}>
    {submit ? <SubmittingStep key={step} submit={submit} /> : <p>sem passo</p>}
  </CadastroShell>
}

function setup(props: Parameters<typeof Page>[0] = {}, entry = "/c?passo=categorias") {
  return render(<MemoryRouter initialEntries={[entry]}>
    <Routes><Route path="/c" element={<Page {...props} />} /></Routes>
    <Probe />
  </MemoryRouter>)
}

beforeEach(() => {
  onBack.mockReset()
  onPublish.mockReset()
})

it("goes to the next step only after the registered submit resolves true", async () => {
  const user = userEvent.setup()
  let release: (ok: boolean) => void = () => undefined
  const submit = vi.fn(() => new Promise<boolean>((resolve) => { release = resolve }))
  setup({ submit })
  await user.click(screen.getByRole("button", { name: "Salvar e continuar" }))
  expect(screen.getByTestId("location")).toHaveTextContent("/c?passo=categorias")
  release(true)
  await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("/c?passo=agenda"))
})

it("stays on the step and keeps the values when the submit resolves false", async () => {
  const user = userEvent.setup()
  const submit = vi.fn().mockResolvedValue(false)
  setup({ submit })
  await user.type(screen.getByRole("textbox", { name: "Campo" }), "abc")
  await user.click(screen.getByRole("button", { name: "Salvar e continuar" }))
  await waitFor(() => expect(submit).toHaveBeenCalledTimes(1))
  expect(screen.getByTestId("location")).toHaveTextContent("/c?passo=categorias")
  expect(screen.getByRole("textbox", { name: "Campo" })).toHaveValue("abc")
  await waitFor(() => expect(screen.getByRole("button", { name: "Salvar e continuar" })).toBeEnabled())
})

it("blocks a double submit while the save is running and shows the loading state", async () => {
  const user = userEvent.setup()
  let release: (ok: boolean) => void = () => undefined
  const submit = vi.fn(() => new Promise<boolean>((resolve) => { release = resolve }))
  setup({ submit })
  const next = screen.getByRole("button", { name: "Salvar e continuar" })
  await user.click(next)
  await user.click(next)
  await user.click(screen.getByRole("button", { name: "Salvar e sair" }))
  expect(submit).toHaveBeenCalledTimes(1)
  expect(next).toHaveAttribute("aria-busy", "true")
  expect(screen.getByRole("button", { name: "Voltar" })).toBeDisabled()
  release(false)
  await waitFor(() => expect(next).toBeEnabled())
})

it("Salvar e sair saves then leaves for the list, and never leaves when the save fails", async () => {
  const user = userEvent.setup()
  const submit = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true)
  setup({ submit })
  await user.click(screen.getByRole("button", { name: "Salvar e sair" }))
  await waitFor(() => expect(submit).toHaveBeenCalledTimes(1))
  expect(onBack).not.toHaveBeenCalled()
  await waitFor(() => expect(screen.getByRole("button", { name: "Salvar e sair" })).toBeEnabled())
  await user.click(screen.getByRole("button", { name: "Salvar e sair" }))
  await waitFor(() => expect(onBack).toHaveBeenCalledTimes(1))
  expect(onPublish).not.toHaveBeenCalled()
})

it("Voltar goes to the previous step without saving or discarding", async () => {
  const user = userEvent.setup()
  const submit = vi.fn().mockResolvedValue(true)
  setup({ submit })
  await user.click(screen.getByRole("button", { name: "Voltar" }))
  expect(screen.getByTestId("location")).toHaveTextContent("/c?passo=dados")
  expect(submit).not.toHaveBeenCalled()
  expect(screen.getByRole("button", { name: "Cancelar" })).toBeInTheDocument()
})

it("shows Cancelar on step 1 and leaves for the list", async () => {
  const user = userEvent.setup()
  setup({}, "/c")
  await user.click(screen.getByRole("button", { name: "Cancelar" }))
  expect(onBack).toHaveBeenCalledTimes(1)
})

it("just navigates when no step registered a submit and never blocks on unsaved text", async () => {
  const user = userEvent.setup()
  setup({}, "/c?passo=fila")
  await user.click(screen.getByRole("button", { name: "Salvar e continuar" }))
  expect(screen.getByTestId("location")).toHaveTextContent("/c?passo=regras")
  expect(screen.queryByText(/restaure os valores/)).not.toBeInTheDocument()
})

it("hides the step's own Save button inside the shell", () => {
  setup({ submit: vi.fn().mockResolvedValue(true) })
  expect(screen.queryByRole("button", { name: "Salvar passo" })).not.toBeInTheDocument()
})

it("the last step shows Publicar, gated by canPublish, and publishes without leaving", async () => {
  const user = userEvent.setup()
  const view = setup({ canPublish: false }, "/c?passo=publicacao")
  expect(screen.getByRole("button", { name: "Publicar" })).toBeDisabled()
  view.unmount()
  setup({ canPublish: true }, "/c?passo=publicacao")
  await user.click(screen.getByRole("button", { name: "Publicar" }))
  await waitFor(() => expect(onPublish).toHaveBeenCalledTimes(1))
  expect(screen.getByTestId("location")).toHaveTextContent("/c?passo=publicacao")
})

it("marks steps from the saved data, not from visits", async () => {
  const user = userEvent.setup()
  setup({ done: ["dados", "agenda"] }, "/c?passo=agenda")
  const nav = screen.getByRole("navigation", { name: "Etapas do cadastro" })
  expect(within(nav).getByRole("button", { name: "Agenda, concluída" })).toHaveAttribute("aria-current", "step")
  expect(within(nav).getByRole("button", { name: "Dados do produto, concluída" })).not.toHaveAttribute("aria-current")
  // Visiting Fila and Regras does not complete them.
  await user.click(within(nav).getByRole("button", { name: "Fila" }))
  await user.click(within(nav).getByRole("button", { name: "Regras" }))
  expect(within(nav).getByRole("button", { name: "Regras" })).toHaveAttribute("aria-current", "step")
  expect(within(nav).getAllByRole("button").filter((button) => /concluída/.test(button.getAttribute("aria-label") ?? ""))).toHaveLength(2)
  expect(within(nav).getByText("Opcional")).toBeInTheDocument()
  expect(screen.getByText("Etapa 5 de 7")).toBeInTheDocument()
})

it("renders the header, the vertical progress copy and one panel with the step title", () => {
  setup({}, "/c")
  expect(screen.getByRole("heading", { level: 1, name: "Diária" })).toBeInTheDocument()
  expect(screen.getByText("Configure seu produto e deixe tudo pronto para receber reservas.")).toBeInTheDocument()
  expect(screen.getByText("Rascunho")).toBeInTheDocument()
  expect(screen.getByText("Configuração do produto")).toBeInTheDocument()
  expect(screen.getByText("No seu tempo")).toBeInTheDocument()
  expect(screen.getByRole("heading", { level: 2, name: "Dados do produto" })).toBeInTheDocument()
  expect(screen.queryByText(/%/)).not.toBeInTheDocument()
})

it("the progress is read-only before the item exists", () => {
  render(<MemoryRouter><CadastroShell kind="product" title="Novo produto" step="dados" go={vi.fn()} interactive={false} busy={false} canPublish={false} onPublish={vi.fn()} onBack={vi.fn()}><p>x</p></CadastroShell></MemoryRouter>)
  const nav = screen.getByRole("navigation", { name: "Etapas do cadastro" })
  expect(within(nav).queryAllByRole("button")).toHaveLength(0)
})

it("asks before Voltar discards a dirty step, but saving then continuing never asks", async () => {
  const user = userEvent.setup()
  const submit = vi.fn().mockResolvedValue(true)
  const router = createMemoryRouter([{ path: "/c", element: <><Page submit={submit} dirty /><Probe /></> }], { initialEntries: ["/c?passo=categorias"] })
  render(<RouterProvider router={router} />)
  await user.click(screen.getByRole("button", { name: "Voltar" }))
  expect(await screen.findByRole("alertdialog")).toBeInTheDocument()
  expect(screen.getByTestId("location")).toHaveTextContent("/c?passo=categorias")
  await user.click(screen.getByRole("button", { name: "Cancelar" }))
  await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument())
  await user.click(screen.getByRole("button", { name: "Salvar e continuar" }))
  await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("/c?passo=agenda"))
  expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
})

it("shows not-applicable steps muted and not clickable, counted as done, with a smaller total", () => {
  setup({ notApplicable: ["agenda", "fila"] }, "/c?passo=regras")
  const nav = screen.getByRole("navigation", { name: "Etapas do cadastro" })
  const agenda = within(nav).getByRole("group", { name: "Agenda, Não se aplica" })
  expect(agenda).toHaveAttribute("aria-disabled", "true")
  expect(within(nav).queryByRole("button", { name: /^Agenda/ })).not.toBeInTheDocument()
  expect(within(nav).queryByRole("button", { name: /^Fila/ })).not.toBeInTheDocument()
  expect(within(nav).getAllByText("Não se aplica")).toHaveLength(2)
  expect(screen.getByText("Etapa 3 de 5")).toBeInTheDocument()
})

it("Salvar e continuar and Voltar skip the steps that do not apply", async () => {
  const user = userEvent.setup()
  setup({ notApplicable: ["agenda", "fila"] }, "/c?passo=categorias")
  await user.click(screen.getByRole("button", { name: "Salvar e continuar" }))
  await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("/c?passo=regras"))
  await user.click(screen.getByRole("button", { name: "Voltar" }))
  await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("/c?passo=categorias"))
})

it("centres the content in a 1120px container", () => {
  setup({}, "/c")
  expect(screen.getByTestId("cadastro-page")).toHaveClass("cadastro-page", "mx-auto", "w-full", "max-w-[1120px]")
})

it("names the current step above one dot per step, the current one included", () => {
  setup({}, "/c?passo=publicacao")
  expect(screen.getByText("Etapa 7 de 7")).toBeInTheDocument()
  expect(screen.getByTestId("cadastro-stepper-name")).toHaveTextContent("· Publicação")
  const dots = screen.getAllByTestId("cadastro-stepper-dot")
  expect(dots).toHaveLength(7)
  expect(dots.filter((dot) => dot.hasAttribute("data-current"))).toHaveLength(1)
  expect(dots[6]).toHaveAttribute("data-current")
})

it("draws one dot per applicable step", () => {
  setup({ notApplicable: ["agenda", "fila"] }, "/c?passo=regras")
  expect(screen.getAllByTestId("cadastro-stepper-dot")).toHaveLength(5)
  expect(screen.getByTestId("cadastro-stepper-name")).toHaveTextContent("· Regras")
})
