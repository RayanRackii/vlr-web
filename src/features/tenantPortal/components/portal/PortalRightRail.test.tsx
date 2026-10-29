import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { afterEach, describe, expect, it, vi } from "vitest"

import i18n from "@/lib/i18n"
import { PortalBookingEmptyState, PortalRightRail } from "./PortalRightRail"
import { PortalBookingHeader } from "./PortalBookingHeader"

describe("PortalRightRail empty states", () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

  it.each([
    [false, "click"], [true, "click"], [false, "keyboard"], [true, "keyboard"],
  ] as const)("scrolls to and focuses the first available space (reduced motion: %s, %s)", async (reducedMotion, interaction) => {
    const user = userEvent.setup()
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: reducedMotion }))
    render(<MemoryRouter><PortalBookingHeader />
      <div id="portal-booking-spaces" tabIndex={-1}>
        <div role="button" tabIndex={0} aria-disabled="true">Recurso indisponível</div>
        <button disabled>Outro recurso indisponível</button>
        <div role="button" tabIndex={0}>Recurso disponível</div>
      </div>
      <PortalRightRail reservationsHref="/t/loja/app/agenda/menu-id?date=2026-10-29#minhas-reservas" />
    </MemoryRouter>)
    const chooser = screen.getByRole("button", { name: "Recurso disponível" })
    const scroll = vi.fn()
    chooser.scrollIntoView = scroll
    const focus = vi.spyOn(chooser, "focus")
    const empty = within(screen.getByRole("status"))
    const book = empty.getByRole("button", { name: i18n.t("emptyStates.book") })
    if (interaction === "keyboard") {
      book.focus()
      await user.keyboard("{Enter}")
    } else {
      await user.click(book)
    }
    expect(chooser).toHaveFocus()
    expect(scroll).toHaveBeenCalledWith({ block: "start", behavior: reducedMotion ? "auto" : "smooth" })
    expect(focus).toHaveBeenCalledWith({ preventScroll: true })
    expect(scroll.mock.invocationCallOrder[0]).toBeLessThan(focus.mock.invocationCallOrder[0])
    expect(empty.getByText(i18n.t("emptyStates.examples.bookings"))).toBeVisible()
    expect(empty.queryByRole("link", { name: i18n.t("emptyStates.learnMore") })).not.toBeInTheDocument()
  })

  it("focuses the chooser region when every resource is unavailable", async () => {
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: true }))
    render(<MemoryRouter>
      <div id="portal-booking-spaces" role="group" aria-label="Recursos" tabIndex={-1}>
        <button disabled>Recurso indisponível</button>
      </div>
      <PortalRightRail reservationsHref="#minhas-reservas" />
    </MemoryRouter>)
    const chooser = screen.getByRole("group", { name: "Recursos" })
    chooser.scrollIntoView = vi.fn()
    await userEvent.setup().click(screen.getByRole("button", { name: i18n.t("emptyStates.book") }))
    expect(chooser).toHaveFocus()
  })

  it("keeps unavailable resources descriptive without suggesting an unavailable booking", () => {
    render(<PortalBookingEmptyState />)
    expect(screen.getByRole("status")).toHaveClass("portal-empty")
    expect(screen.getByText(i18n.t("tenantPortal.redesign.emptyHelp"))).toBeVisible()
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
    expect(screen.queryByRole("link")).not.toBeInTheDocument()
  })
})
