import { render, screen, within } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { describe, expect, it, vi } from "vitest"

import { AppShell } from "@/components/layout/AppShell"
import { PageHeader } from "@/components/layout/PageHeader"
import i18n from "@/lib/i18n"

function renderShell(variant: "staff" | "portal" = "staff") {
  return render(
    <MemoryRouter>
      <AppShell
        variant={variant}
        sidebar={(opts) => <nav aria-label="Side">{opts.account}</nav>}
        pageTitle="Agendas"
        userLabel="Ana"
        initials="AN"
        onSignOut={vi.fn()}
        headerStart={<nav aria-label="Crumbs">Workspace / Agendas</nav>}
      >
        <PageHeader title="Visão geral" eyebrow="Eyebrow" />
      </AppShell>
    </MemoryRouter>,
  )
}

describe("AppShell target layout", () => {
  it("renders headerStart inside the header and not inside main", () => {
    const { container } = renderShell()
    const header = container.querySelector('[data-shell-part="header"]') as HTMLElement
    const main = container.querySelector('[data-shell-part="main"]') as HTMLElement
    expect(within(header).getByRole("navigation", { name: "Crumbs" })).toBeInTheDocument()
    expect(within(main).queryByRole("navigation", { name: "Crumbs" })).not.toBeInTheDocument()
  })

  it("shows the header breadcrumb from lg up only", () => {
    const { container } = renderShell()
    const wrapper = container.querySelector('[data-shell-part="header-start"]')
    expect(wrapper).toHaveClass("hidden", "lg:block")
  })

  it("has no theme toggle in the staff header and hides the page eyebrow", () => {
    const { container } = renderShell()
    const header = container.querySelector('[data-shell-part="header"]') as HTMLElement
    expect(within(header).queryByRole("button", { name: i18n.t("theme.toggle") })).not.toBeInTheDocument()
    expect(screen.queryByText("Eyebrow")).not.toBeInTheDocument()
  })

  it("keeps the portal header as before: theme toggle, account menu, eyebrow", () => {
    const { container } = renderShell("portal")
    const header = container.querySelector('[data-shell-part="header"]') as HTMLElement
    expect(header).toHaveClass("h-14")
    expect(within(header).getByRole("button", { name: i18n.t("theme.toggle") })).toBeInTheDocument()
    expect(within(header).getByRole("button", { name: i18n.t("account.openMenu") })).toBeInTheDocument()
    expect(within(header).queryByRole("navigation", { name: "Crumbs" })).not.toBeInTheDocument()
    expect(screen.getByText("Eyebrow")).toBeInTheDocument()
  })
})
