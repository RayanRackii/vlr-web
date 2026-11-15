import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { describe, expect, it } from "vitest"

import { FeatureRouteTabs } from "@/components/layout/FeatureRouteTabs"
import { PageHeader } from "@/components/layout/PageHeader"
import { TestPermissionProvider } from "@/features/users/permissions/PermissionContext"

const tabs = [
  { labelKey: "nav.assetsInventory", to: "/ativos", permission: "inventory.assets.read", modules: ["inventory"] },
  { labelKey: "nav.assetsResourceTypes", to: "/ativos/tipos", permission: "inventory.categories.read", modules: ["inventory"] },
] as const

function renderTabs(path = "/ativos") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <TestPermissionProvider permissions={["inventory.assets.read", "inventory.categories.read"]} activeModules={["inventory"]}>
        <FeatureRouteTabs
          labelKey="nav.assets"
          tabs={tabs}
          header={<PageHeader title="Equipamentos" />}
          content={{
            "/ativos": <PageHeader title="Inventário" description="Lista" actions={<button type="button">Novo</button>} />,
            "/ativos/tipos": <PageHeader title="Tipos" />,
          }}
        />
      </TestPermissionProvider>
    </MemoryRouter>,
  )
}

describe("FeatureRouteTabs header", () => {
  it("renders exactly one h1, before the tabs in DOM order", () => {
    renderTabs()
    const h1s = screen.getAllByRole("heading", { level: 1 })
    expect(h1s).toHaveLength(1)
    expect(h1s[0]).toHaveTextContent("Equipamentos")
    const tablist = screen.getByRole("tablist")
    expect(h1s[0].compareDocumentPosition(tablist) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it("renders the tab content header as an h2 section header with description and actions", () => {
    renderTabs()
    const h2 = screen.getByRole("heading", { level: 2, name: "Inventário" })
    expect(h2).toBeInTheDocument()
    expect(screen.getByText("Lista")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Novo" })).toBeInTheDocument()
    expect(screen.getByRole("tablist").compareDocumentPosition(h2) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(h2.closest("div")?.parentElement?.className ?? "").not.toContain("animate-in")
  })

  it("keeps the feature header on every tab", () => {
    renderTabs("/ativos/tipos")
    expect(screen.getByRole("heading", { level: 1, name: "Equipamentos" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { level: 2, name: "Tipos" })).toBeInTheDocument()
  })
})
