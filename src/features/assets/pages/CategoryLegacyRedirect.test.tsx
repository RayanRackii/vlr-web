import { render, screen } from "@testing-library/react"
import { createMemoryRouter, RouterProvider } from "react-router-dom"
import { describe, expect, it, vi } from "vitest"

import { assetsManifest } from "@/features/assets/manifest"

vi.mock("@/features/assets/pages/EquipmentPage", () => ({
  EquipmentPage: () => <h1>tipos</h1>,
}))
vi.mock("@/features/assets/pages/ResourceTypeWizardPage", () => ({
  ResourceTypeWizardPage: () => <h1>wizard</h1>,
}))
vi.mock("@/features/assets/pages/AssetCreatePage", () => ({
  AssetCreatePage: () => <h1>novo equipamento</h1>,
}))

const routes = assetsManifest.routes.staff.map((route) => ({
  path: route.path,
  element: route.element,
}))

function visit(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(<RouterProvider router={router} />)
  return router
}

describe("old equipment type editor routes", () => {
  it.each([
    ["/ativos/categorias", "/ativos/tipos", "tipos"],
    ["/ativos/categorias/", "/ativos/tipos", "tipos"],
    ["/ativos/categorias/novo", "/ativos/tipos/novo", "wizard"],
    ["/ativos/categorias/novo/", "/ativos/tipos/novo", "wizard"],
    ["/ativos/categorias/11111111-1111-4111-8111-111111111111", "/ativos/tipos", "tipos"],
  ])("redirects %s to %s", async (from, to, heading) => {
    const router = visit(from)
    expect(await screen.findByRole("heading", { name: heading })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(to)
  })
})
