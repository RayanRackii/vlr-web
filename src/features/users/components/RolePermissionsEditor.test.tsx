import { useState } from "react"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { expect, it } from "vitest"

import { RolePermissionsEditor } from "./RolePermissionsEditor"

const CATALOG = [
  { key: "catalog.zzitems.read", name: "Ver produtos", moduleKey: "catalog", resource: "products" },
  { key: "catalog.zzitems.manage", name: "Gerenciar produtos", moduleKey: "catalog", resource: "products" },
  { key: "core.zzpeople.read", name: "Ver pessoas", moduleKey: "core", resource: "users" },
]

function Harness({ initial = [] as string[] }) {
  const [keys, setKeys] = useState<string[]>(initial)
  return (
    <>
      <RolePermissionsEditor catalog={CATALOG} activeModules={["catalog", "core"]} selectedKeys={keys} onChange={setKeys} />
      <output data-testid="keys">{[...keys].sort().join(",")}</output>
    </>
  )
}

it("selects a whole module, shows partial state and the x de y counter", async () => {
  const user = userEvent.setup()
  render(<Harness initial={["catalog.zzitems.read"]} />)
  const all = screen.getByRole("checkbox", { name: /Marcar módulo todo: Cat/i }) as HTMLInputElement
  expect(all.indeterminate).toBe(true)
  const section = all.closest("section") as HTMLElement
  expect(within(section).getByText("1 de 2")).toBeInTheDocument()

  await user.click(all)
  expect(screen.getByTestId("keys")).toHaveTextContent("catalog.zzitems.manage,catalog.zzitems.read")
  expect(within(section).getByText("2 de 2")).toBeInTheDocument()
  expect(all.indeterminate).toBe(false)
})

it("search filters modules and opens the one with a match", async () => {
  const user = userEvent.setup()
  render(<Harness />)
  await user.type(screen.getByLabelText("Buscar permissão"), "pessoas")
  expect(screen.getByText("Ver pessoas")).toBeVisible()
  expect(screen.queryByText("Ver produtos")).not.toBeInTheDocument()
})
