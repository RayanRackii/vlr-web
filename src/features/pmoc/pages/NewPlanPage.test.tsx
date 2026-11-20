import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { describe, expect, it, vi } from "vitest"

import { NewPlanPage } from "@/features/pmoc/pages/NewPlanPage"
import { TestPermissionProvider } from "@/features/users/permissions/PermissionContext"

vi.mock("@/features/pmoc/pages/PmocLibraryPage", () => ({ PmocLibraryPage: () => <p>library body</p> }))
vi.mock("@/features/pmoc/pages/CreatePlanPage", () => ({ CreatePlanPage: () => <p>create body</p> }))

describe("NewPlanPage", () => {
  it("names the library page for the library, not 'Novo plano'", () => {
    render(
      <MemoryRouter initialEntries={["/pmoc/biblioteca"]}>
        <TestPermissionProvider permissions={["pmoc.plans.write", "pmoc.templates.read"]} activeModules={["pmoc"]}>
          <NewPlanPage />
        </TestPermissionProvider>
      </MemoryRouter>,
    )
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Biblioteca Rolvix")
    expect(screen.getByText("library body")).toBeInTheDocument()
  })
})
