import { readFileSync } from "node:fs"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { parse } from "postcss"
import { expect, it, vi } from "vitest"
import i18n from "@/lib/i18n"
import { CustomerSidebar } from "@/features/tenantPortal/components/CustomerSidebar"
import { AppShell } from "./AppShell"

it("supports the account menu keyboard pattern: arrows reach items and Tab exits", async () => {
  const user = userEvent.setup()
  render(<MemoryRouter><AppShell sidebar={() => <nav>Links</nav>} pageTitle="Portal" userLabel="Ana" initials="AN" profileTo="/profile" onSignOut={vi.fn()}><button>Content action</button></AppShell></MemoryRouter>)
  const trigger = screen.getByRole("button", { name: i18n.t("account.openMenu") })
  trigger.focus()
  await user.keyboard("{Enter}")
  const profile = await screen.findByRole("menuitem", { name: i18n.t("account.profile") })
  expect(profile).toHaveFocus()
  await user.keyboard("{ArrowDown}")
  expect(screen.getByRole("menuitem", { name: i18n.t("account.signOut") })).toHaveFocus()
  await user.tab()
  expect(screen.queryByRole("menu")).not.toBeInTheDocument()
})

it("lets a long mobile title wrap instead of clipping", () => {
  render(<MemoryRouter><AppShell sidebar={() => <nav>Links</nav>} pageTitle="Regras de reserva" userLabel="Ana" initials="AN" onSignOut={vi.fn()}>Content</AppShell></MemoryRouter>)
  const title = screen.getByText("Regras de reserva")
  expect(title).not.toHaveClass("truncate")
  expect(title).toHaveClass("break-words")
})

it("keeps the staff hamburger and mobile drawer available by default", async () => {
  const user = userEvent.setup()
  render(<MemoryRouter><AppShell sidebar={() => <nav aria-label="Staff">Staff links</nav>} pageTitle="Staff" userLabel="Staff" initials="ST" onSignOut={vi.fn()}>Content</AppShell></MemoryRouter>)
  const toggle = screen.getByRole("button", { name: i18n.t("nav.openMenu") })
  expect(toggle).not.toHaveAttribute("hidden")
  expect(toggle.closest('[data-shell-variant="staff"]')).toBeInTheDocument()
  await user.click(toggle)
  expect(within(await screen.findByRole("dialog")).getByRole("navigation", { name: "Staff" })).toBeInTheDocument()
})

it("places portal navigation in the header and fixes the same navigation to the mobile bottom", () => {
  const { container } = render(<MemoryRouter><div className="portal-shell"><AppShell variant="portal" sidebar={() => <CustomerSidebar brandLabel="Club" items={[]} />} pageTitle="Portal" userLabel="Ana" initials="AN" onSignOut={vi.fn()}>Content</AppShell></div></MemoryRouter>)
  const header = container.querySelector('[data-shell-part="header"]')
  const nav = screen.getByRole("navigation", { name: i18n.t("nav.menu") })
  expect(header).toContainElement(nav)
  expect(container.querySelector('[data-shell-part="sidebar"]')).not.toBeInTheDocument()
  expect(container.querySelector('[data-shell-part="menu-toggle"]')).toHaveAttribute("hidden")
  for (const part of ["root", "body", "header", "main"]) {
    expect(container.querySelector(`[data-shell-part="${part}"]`)).toBeInTheDocument()
  }

  // jsdom does not apply media queries: verify the responsive CSS contract directly.
  const css = parse(readFileSync("src/features/tenantPortal/components/portal/portal.css", "utf8"))
  let desktopTopNav = false
  let mobileBottomNav = false
  css.walkRules((rule) => {
    if (rule.selector === ".portal-nav" && rule.parent?.type === "root") {
      rule.walkDecls("display", (declaration) => { desktopTopNav = declaration.value === "flex" })
    }
    if (rule.selector === ".portal-nav" && rule.parent?.type === "atrule" && rule.parent.params === "(max-width: 1023px)") {
      const declarations = Object.fromEntries(rule.nodes.filter((node) => node.type === "decl").map((node) => [node.prop, node.value]))
      mobileBottomNav = declarations.position === "fixed" && declarations.inset === "auto 0 0" && declarations.display === "grid"
    }
  })
  expect(desktopTopNav).toBe(true)
  expect(mobileBottomNav).toBe(true)
})
