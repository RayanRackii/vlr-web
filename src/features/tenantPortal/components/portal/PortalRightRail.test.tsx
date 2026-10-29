import { fireEvent, render, screen, within } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { afterEach, describe, expect, it, vi } from "vitest"

import i18n from "@/lib/i18n"
import { PortalBookingEmptyState, PortalRightRail } from "./PortalRightRail"
import { PortalBookingHeader } from "./PortalBookingHeader"

describe("PortalRightRail empty states", () => {
  afterEach(() => vi.unstubAllGlobals())

  it.each([false, true])("scrolls to and focuses the booking heading (reduced motion: %s)", (reducedMotion) => {
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: reducedMotion }))
    render(<MemoryRouter><PortalBookingHeader /><PortalRightRail reservationsHref="/t/loja/app/agenda/menu-id?date=2026-10-29#minhas-reservas" /></MemoryRouter>)
    const heading = screen.getByRole("heading", { level: 1 })
    const scroll = vi.fn()
    heading.scrollIntoView = scroll
    const empty = within(screen.getByRole("status"))
    fireEvent.click(empty.getByRole("button", { name: i18n.t("emptyStates.book") }))
    expect(heading).toHaveFocus()
    expect(scroll).toHaveBeenCalledWith({ block: "start", behavior: reducedMotion ? "auto" : "smooth" })
    expect(empty.getByText(i18n.t("emptyStates.examples.bookings"))).toBeVisible()
    expect(empty.queryByRole("link", { name: i18n.t("emptyStates.learnMore") })).not.toBeInTheDocument()
  })

  it("keeps unavailable resources descriptive without suggesting an unavailable booking", () => {
    render(<PortalBookingEmptyState />)
    expect(screen.getByRole("status")).toHaveClass("portal-empty")
    expect(screen.getByText(i18n.t("tenantPortal.redesign.emptyHelp"))).toBeVisible()
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
    expect(screen.queryByRole("link")).not.toBeInTheDocument()
  })
})
