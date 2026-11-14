import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { SidebarAccount } from "@/components/layout/SidebarAccount"
import i18n from "@/lib/i18n"

const setTheme = vi.fn()
vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: "light", resolvedTheme: "light", setTheme }),
}))

function renderAccount(props: Partial<React.ComponentProps<typeof SidebarAccount>> = {}) {
  const onSignOut = vi.fn()
  render(
    <MemoryRouter>
      <SidebarAccount
        userLabel="Rayan Racki"
        email="rayan@example.com"
        initials="RR"
        roleLabel="Administrador"
        profileTo="/perfil"
        isSigningOut={false}
        onSignOut={onSignOut}
        {...props}
      />
    </MemoryRouter>,
  )
  return { onSignOut }
}

describe("SidebarAccount", () => {
  beforeEach(() => setTheme.mockClear())

  it("shows the name and role on the card", () => {
    renderAccount()
    const trigger = screen.getByRole("button", { name: i18n.t("account.openMenu") })
    expect(trigger).toHaveTextContent("Rayan Racki")
    expect(trigger).toHaveTextContent("Administrador")
  })

  it("shows only the avatar when collapsed", () => {
    renderAccount({ collapsed: true })
    const trigger = screen.getByRole("button", { name: i18n.t("account.openMenu") })
    expect(trigger).not.toHaveTextContent("Rayan Racki")
    expect(trigger).toHaveTextContent("RR")
  })

  it("opens the menu with the profile link", async () => {
    renderAccount()
    await userEvent.click(screen.getByRole("button", { name: i18n.t("account.openMenu") }))
    expect(await screen.findByText("rayan@example.com")).toBeInTheDocument()
    expect(screen.getByRole("menuitem", { name: i18n.t("account.profile") })).toHaveAttribute("href", "/perfil")
  })

  it("changes the theme from the menu", async () => {
    renderAccount()
    await userEvent.click(screen.getByRole("button", { name: i18n.t("account.openMenu") }))
    await userEvent.click(await screen.findByRole("menuitem", { name: i18n.t("theme.dark") }))
    expect(setTheme).toHaveBeenCalledWith("dark")
  })

  it("signs out once", async () => {
    const { onSignOut } = renderAccount()
    await userEvent.click(screen.getByRole("button", { name: i18n.t("account.openMenu") }))
    await userEvent.click(await screen.findByRole("menuitem", { name: i18n.t("account.signOut") }))
    expect(onSignOut).toHaveBeenCalledTimes(1)
  })
})
