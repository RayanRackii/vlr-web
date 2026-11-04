import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { expect, it, vi } from "vitest"

import { EntityPage } from "./EntityPage"

it("shows the save bar with the unsaved count only when dirty, and fires discard/save", async () => {
  const user = userEvent.setup()
  const onSave = vi.fn()
  const onDiscard = vi.fn()
  const { rerender } = render(
    <EntityPage title="Role" dirty={false} unsavedCount={0} onSave={onSave} onDiscard={onDiscard} />,
  )
  expect(screen.queryByText(/não salva/)).not.toBeInTheDocument()

  rerender(
    <EntityPage title="Role" dirty unsavedCount={3} onSave={onSave} onDiscard={onDiscard} />,
  )
  expect(screen.getByText("3 alterações não salvas")).toBeInTheDocument()

  await user.click(screen.getByRole("button", { name: "Descartar" }))
  expect(onDiscard).toHaveBeenCalledTimes(1)
  await user.click(screen.getAllByRole("button", { name: "Salvar" })[0])
  expect(onSave).toHaveBeenCalled()
})

it("renders tabs and switches panels", async () => {
  const user = userEvent.setup()
  render(
    <EntityPage
      title="Role"
      tabs={[
        { value: "data", label: "Dados", content: <p>data panel</p> },
        { value: "members", label: "Membros", badge: 2, content: <p>members panel</p> },
      ]}
    />,
  )
  expect(screen.getByText("data panel")).toBeInTheDocument()
  await user.click(screen.getByRole("tab", { name: /Membros/ }))
  expect(screen.getByText("members panel")).toBeInTheDocument()
})
