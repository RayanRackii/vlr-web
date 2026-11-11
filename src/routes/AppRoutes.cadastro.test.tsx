import { render, screen } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { expect, it, vi } from "vitest"
import { catalogManifest } from "@/features/catalog/manifest"
import { rentalsManifest } from "@/features/rentals/manifest"
import { taxonomyManifest } from "@/features/taxonomy/manifest"
import { TestPermissionProvider } from "@/features/users/permissions/PermissionContext"

vi.mock("@/features/catalog/pages/CatalogProductEditorPage", () => ({ CatalogProductEditorPage: () => <h1>Legacy product detail</h1> }))
vi.mock("@/features/assistant/ProductCadastroCreatePage", () => ({ ProductCadastroCreatePage: () => <h1>Product cadastro create</h1> }))
vi.mock("@/features/assistant/ProductAssistantPage", () => ({ ProductAssistantPage: ({ cadastro }: { cadastro?: boolean }) => <h1>{cadastro ? "Product cadastro" : "Legacy product steps"}</h1> }))
vi.mock("@/features/rentals/pages/RentalResourceEditorPage", () => ({ RentalResourceEditorPage: ({ cadastro }: { cadastro?: boolean }) => <h1>{cadastro ? "Resource cadastro create" : "Legacy resource editor"}</h1> }))
vi.mock("@/features/assistant/ResourceAssistantPage", () => ({ ResourceAssistantPage: ({ cadastro }: { cadastro?: boolean }) => <h1>{cadastro ? "Resource cadastro" : "Legacy resource steps"}</h1> }))
vi.mock("@/features/taxonomy/pages/TaxonomyPage", () => ({ TaxonomyPage: () => <h1>Legacy taxonomy</h1> }))

it.each([
  ["/catalogo/produtos/cadastro", "Product cadastro create"],
  ["/catalogo/produtos/p1/cadastro", "Product cadastro"],
  ["/catalogo/produtos/novo", "Product cadastro create"],
  ["/catalogo/produtos/p1", "Legacy product detail"],
  ["/catalogo/produtos/p1/assistente", "Product cadastro"],
  ["/catalogo/produtos/p1/passos", "Product cadastro"],
  ["/configuracoes/recursos/cadastro", "Resource cadastro create"],
  ["/configuracoes/recursos/r1/cadastro", "Resource cadastro"],
  ["/configuracoes/recursos/novo", "Resource cadastro create"],
  ["/configuracoes/recursos/r1", "Legacy resource editor"],
  ["/configuracoes/recursos/r1/assistente", "Resource cadastro"],
  ["/configuracoes/recursos/r1/passos", "Resource cadastro"],
  ["/configuracoes/categorias-tags", "Legacy taxonomy"],
])("keeps the intended staff page reachable at %s", (path, title) => {
  render(<MemoryRouter initialEntries={[path]}>
    <TestPermissionProvider permissions={["rentals.assets.write", "core.units.read", "catalog.products.read", "catalog.products.manage"]} activeModules={["rentals", "catalog"]}>
      <Routes>
        {[...catalogManifest.routes.staff, ...rentalsManifest.routes.staff, ...taxonomyManifest.routes.staff].map((route) => <Route key={route.path} path={route.path} element={route.element} />)}
      </Routes>
    </TestPermissionProvider>
  </MemoryRouter>)
  expect(screen.getByRole("heading", { name: title, level: 1 })).toBeInTheDocument()
  expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1)
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
})

it("sends a resource reader from the old wizard to the read-only editor", () => {
  render(<MemoryRouter initialEntries={["/configuracoes/recursos/r1/assistente?passo=rules"]}>
    <TestPermissionProvider permissions={["rentals.assets.read", "core.units.read"]} activeModules={["rentals"]}>
      <Routes>
        {rentalsManifest.routes.staff.map((route) => <Route key={route.path} path={route.path} element={route.element} />)}
      </Routes>
    </TestPermissionProvider>
  </MemoryRouter>)
  expect(screen.getByRole("heading", { name: "Legacy resource editor", level: 1 })).toBeInTheDocument()
  expect(screen.queryByRole("heading", { name: "Resource cadastro" })).not.toBeInTheDocument()
})
