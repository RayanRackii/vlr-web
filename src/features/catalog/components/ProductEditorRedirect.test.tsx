import { render, screen } from "@testing-library/react"
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom"
import { expect, it } from "vitest"

import { ProductEditorRedirect, ProductLegacyEditorRedirect, ProductViewEntry } from "@/features/catalog/components/ProductEditorRedirect"

function Probe() {
  const location = useLocation()
  return <p data-testid="where">{location.pathname}{location.search}</p>
}

function renderAt(entry: string) {
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/catalogo/produtos/:id/assistente" element={<ProductEditorRedirect />} />
        <Route path="/catalogo/produtos/:id/passos" element={<ProductEditorRedirect />} />
        <Route path="/catalogo/produtos/:id/editar-legado" element={<ProductLegacyEditorRedirect />} />
        <Route path="/catalogo/produtos/:id/cadastro" element={<Probe />} />
        <Route path="/catalogo/produtos/:id" element={<ProductViewEntry><Probe /></ProductViewEntry>} />
      </Routes>
    </MemoryRouter>,
  )
}

it.each([
  ["/catalogo/produtos/p1/assistente", "/catalogo/produtos/p1/cadastro?modo=editar"],
  ["/catalogo/produtos/p1/passos", "/catalogo/produtos/p1/cadastro?modo=editar"],
  ["/catalogo/produtos/p1/passos?passo=agenda", "/catalogo/produtos/p1/cadastro?modo=editar&passo=agenda"],
  ["/catalogo/produtos/p1/assistente?passo=resource", "/catalogo/produtos/p1/cadastro?modo=editar&passo=agenda"],
  ["/catalogo/produtos/p1/assistente?passo=offer", "/catalogo/produtos/p1/cadastro?modo=editar&passo=precos"],
  ["/catalogo/produtos/p1/passos?passo=access", "/catalogo/produtos/p1/cadastro?modo=editar&passo=regras"],
  ["/catalogo/produtos/p1/passos?passo=arquivos", "/catalogo/produtos/p1/cadastro?modo=editar&passo=arquivos"],
])("redirects the old assistant %s to the wizard edit mode", (entry, expected) => {
  renderAt(entry)
  expect(screen.getByTestId("where").textContent).toBe(expected)
})

it.each([
  ["/catalogo/produtos/p1/editar-legado", "/catalogo/produtos/p1"],
  ["/catalogo/produtos/p1/editar-legado?aba=history", "/catalogo/produtos/p1"],
  ["/catalogo/produtos/p1/editar-legado?aba=unknown", "/catalogo/produtos/p1"],
  ["/catalogo/produtos/p1/editar-legado?aba=access", "/catalogo/produtos/p1/cadastro?modo=editar&passo=regras"],
  ["/catalogo/produtos/p1/editar-legado?aba=files", "/catalogo/produtos/p1/cadastro?modo=editar&passo=arquivos"],
])("redirects the retired editor %s", (entry, expected) => {
  renderAt(entry)
  expect(screen.getByTestId("where").textContent).toBe(expected)
})

it.each([
  ["access", "/catalogo/produtos/p1/cadastro?modo=editar&passo=regras"],
  ["files", "/catalogo/produtos/p1/cadastro?modo=editar&passo=arquivos"],
  ["agenda", "/catalogo/produtos/p1/cadastro?modo=editar&passo=agenda"],
  ["price", "/catalogo/produtos/p1/cadastro?modo=editar&passo=precos"],
  ["dados", "/catalogo/produtos/p1/cadastro?modo=editar"],
  ["history", "/catalogo/produtos/p1"],
  ["whatever", "/catalogo/produtos/p1"],
])("sends the legacy view link ?aba=%s to %s without looping", (aba, expected) => {
  renderAt(`/catalogo/produtos/p1?aba=${aba}`)
  expect(screen.getByTestId("where").textContent).toBe(expected)
})

it("renders the view when there is no aba", () => {
  renderAt("/catalogo/produtos/p1")
  expect(screen.getByTestId("where").textContent).toBe("/catalogo/produtos/p1")
})
