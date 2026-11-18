import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createMemoryRouter, MemoryRouter, RouterProvider } from "react-router-dom"
import { describe, expect, it, vi } from "vitest"

import { FormPage } from "./FormPage"
import { SaveBar } from "./SaveBar"

type SubmitEvent = { preventDefault: () => void }
const preventSubmit = () => vi.fn((event: SubmitEvent) => event.preventDefault())

describe("SaveBar", () => {
  it("keeps Save disabled until dirty and fires onSave", async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    const { rerender } = render(<SaveBar dirty={false} onSave={onSave} />)
    expect(screen.getByRole("button", { name: "Salvar" })).toBeDisabled()

    rerender(<SaveBar dirty unsavedCount={2} onSave={onSave} />)
    expect(screen.getByText("2 alterações não salvas")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Salvar" }))
    expect(onSave).toHaveBeenCalledTimes(1)
  })

  it("renders Save as a submit button for the given form and calls onDiscard", async () => {
    const user = userEvent.setup()
    const onSubmit = preventSubmit()
    const onDiscard = vi.fn()
    render(
      <>
        <form id="f" onSubmit={onSubmit} />
        <SaveBar dirty submitFormId="f" onDiscard={onDiscard} />
      </>,
    )
    const save = screen.getByRole("button", { name: "Salvar" })
    expect(save).toHaveAttribute("type", "submit")
    expect(save).toHaveAttribute("form", "f")
    await user.click(save)
    expect(onSubmit).toHaveBeenCalledTimes(1)
    await user.click(screen.getByRole("button", { name: "Descartar" }))
    expect(onDiscard).toHaveBeenCalledTimes(1)
  })

  it("enables Save on a pristine form when saveRequiresDirty is false", () => {
    const { rerender } = render(<SaveBar dirty={false} saveRequiresDirty={false} onSave={vi.fn()} />)
    expect(screen.getByRole("button", { name: "Salvar" })).toBeEnabled()
    rerender(<SaveBar dirty={false} saveRequiresDirty={false} saveDisabled onSave={vi.fn()} />)
    expect(screen.getByRole("button", { name: "Salvar" })).toBeDisabled()
  })

  it("disables Save while saveDisabled and shows the saving label", () => {
    const { rerender } = render(<SaveBar dirty saveDisabled onSave={vi.fn()} />)
    expect(screen.getByRole("button", { name: "Salvar" })).toBeDisabled()
    rerender(<SaveBar dirty saving savingLabel="Salvando" onSave={vi.fn()} />)
    expect(screen.getByRole("button", { name: "Salvando" })).toBeDisabled()
  })
})

describe("FormPage", () => {
  const header = { title: "Novo item" }

  it("renders a single h1, the children and a disabled Save when pristine", () => {
    render(
      <MemoryRouter>
        <FormPage header={header} dirty={false} onSave={vi.fn()}>
          <p>fields</p>
        </FormPage>
      </MemoryRouter>,
    )
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1)
    expect(screen.getByText("fields")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Salvar" })).toBeDisabled()
  })

  it("submits the form through the bar when submitFormId is set", async () => {
    const user = userEvent.setup()
    const onSubmit = preventSubmit()
    render(
      <MemoryRouter>
        <FormPage header={header} dirty submitFormId="f">
          <form id="f" onSubmit={onSubmit} />
        </FormPage>
      </MemoryRouter>,
    )
    await user.click(screen.getByRole("button", { name: "Salvar" }))
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it("hides the bar while loading", () => {
    render(
      <MemoryRouter>
        <FormPage header={header} state="loading" dirty onSave={vi.fn()}>
          <p>fields</p>
        </FormPage>
      </MemoryRouter>,
    )
    expect(screen.queryByRole("button", { name: "Salvar" })).not.toBeInTheDocument()
  })

  function renderWithRouter(dirty: boolean, extra?: { guardUnsaved?: boolean; saving?: boolean }) {
    const router = createMemoryRouter(
      [
        {
          path: "/",
          element: (
            <FormPage header={header} dirty={dirty} onSave={vi.fn()} {...extra}>
              <p>fields</p>
            </FormPage>
          ),
        },
        { path: "/other", element: <p>other page</p> },
      ],
      { initialEntries: ["/"] },
    )
    render(<RouterProvider router={router} />)
    return router
  }

  it("opens the leave dialog when navigating away with unsaved changes", async () => {
    const router = renderWithRouter(true)
    await router.navigate("/other")
    expect(await screen.findByRole("alertdialog")).toBeInTheDocument()
    expect(screen.queryByText("other page")).not.toBeInTheDocument()
  })

  it("does not guard when pristine, when guardUnsaved is false or while saving", async () => {
    const cases = [
      { dirty: false, extra: undefined },
      { dirty: true, extra: { guardUnsaved: false } },
      { dirty: true, extra: { saving: true } },
    ]
    for (const { dirty, extra } of cases) {
      const router = renderWithRouter(dirty, extra)
      await router.navigate("/other")
      expect(await screen.findByText("other page")).toBeInTheDocument()
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
      cleanup()
    }
  })
})
