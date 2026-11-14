import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createMemoryRouter, Link, Outlet, RouterProvider, useLocation } from "react-router-dom"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import i18n from "@/lib/i18n"
import { AppErrorBoundary } from "./AppErrorBoundary"

let shouldThrow = true
function Bomb() {
  if (shouldThrow) throw new Error("boom")
  return <p>recovered</p>
}

describe("AppErrorBoundary", () => {
  beforeEach(() => {
    shouldThrow = true
    vi.spyOn(console, "error").mockImplementation(() => undefined)
  })
  afterEach(() => vi.restoreAllMocks())

  it("renders the fallback with a home link when a child throws", () => {
    render(<AppErrorBoundary><Bomb /></AppErrorBoundary>)
    expect(screen.getByText(i18n.t("app.errorBoundary.title"))).toBeInTheDocument()
    expect(screen.getByRole("link", { name: i18n.t("app.errorBoundary.home") })).toHaveAttribute("href", "/")
  })

  it("retry re-renders the children", async () => {
    render(<AppErrorBoundary><Bomb /></AppErrorBoundary>)
    shouldThrow = false
    await userEvent.setup().click(screen.getByRole("button", { name: i18n.t("common.retry") }))
    expect(screen.getByText("recovered")).toBeInTheDocument()
  })

  it("resets when keyed by route change", async () => {
    function Layout() {
      const location = useLocation()
      return (
        <>
          <Link to="/ok">ok</Link>
          <AppErrorBoundary key={location.pathname}><Outlet /></AppErrorBoundary>
        </>
      )
    }
    const router = createMemoryRouter(
      [{ element: <Layout />, children: [{ path: "/bad", element: <Bomb /> }, { path: "/ok", element: <p>fine</p> }] }],
      { initialEntries: ["/bad"] },
    )
    render(<RouterProvider router={router} />)
    expect(screen.getByText(i18n.t("app.errorBoundary.title"))).toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole("link", { name: "ok" }))
    expect(screen.getByText("fine")).toBeInTheDocument()
  })
})
