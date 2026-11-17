import { render, screen } from "@testing-library/react"
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom"
import { expect, it } from "vitest"

import { ProductEditorRedirect } from "@/features/catalog/components/ProductEditorRedirect"

function Probe() {
  const location = useLocation()
  return <p data-testid="where">{location.pathname}{location.search}</p>
}

it.each([
  ["/catalogo/produtos/p1/assistente", "/catalogo/produtos/p1/editar-legado"],
  ["/catalogo/produtos/p1/passos", "/catalogo/produtos/p1/editar-legado"],
  ["/catalogo/produtos/p1/passos?passo=agenda", "/catalogo/produtos/p1/editar-legado?aba=agenda"],
  ["/catalogo/produtos/p1/assistente?passo=resource", "/catalogo/produtos/p1/editar-legado?aba=agenda"],
  ["/catalogo/produtos/p1/assistente?passo=offer", "/catalogo/produtos/p1/editar-legado?aba=price"],
  ["/catalogo/produtos/p1/passos?passo=access", "/catalogo/produtos/p1/editar-legado?aba=access"],
])("redirects %s to the legacy editor", (entry, expected) => {
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/catalogo/produtos/:id/assistente" element={<ProductEditorRedirect />} />
        <Route path="/catalogo/produtos/:id/passos" element={<ProductEditorRedirect />} />
        <Route path="/catalogo/produtos/:id/editar-legado" element={<Probe />} />
      </Routes>
    </MemoryRouter>,
  )
  expect(screen.getByTestId("where")).toHaveTextContent(expected)
})
