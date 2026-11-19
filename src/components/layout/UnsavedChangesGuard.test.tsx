import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Link, RouterProvider, createMemoryRouter } from "react-router-dom"
import { describe, expect, it } from "vitest"

import { UnsavedChangesGuard } from "@/components/layout/UnsavedChangesGuard"
import i18n from "@/lib/i18n"

function renderGuard(when: boolean) {
  const router = createMemoryRouter(
    [
      {
        path: "/edit",
        element: (
          <>
            <UnsavedChangesGuard when={when} />
            <Link to="/edit?tab=portal">same page</Link>
            <Link to="/other">other page</Link>
          </>
        ),
      },
      { path: "/other", element: <p>other</p> },
    ],
    { initialEntries: ["/edit"] },
  )
  render(<RouterProvider router={router} />)
  return router
}

describe("UnsavedChangesGuard", () => {
  it("does not open the leave dialog for a search-param-only change", async () => {
    const user = userEvent.setup()
    const router = renderGuard(true)

    await user.click(screen.getByRole("link", { name: "same page" }))

    expect(router.state.location.search).toBe("?tab=portal")
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
  })

  it("opens the leave dialog when the pathname changes while dirty", async () => {
    const user = userEvent.setup()
    const router = renderGuard(true)

    await user.click(screen.getByRole("link", { name: "other page" }))

    expect(await screen.findByRole("alertdialog")).toBeInTheDocument()
    expect(router.state.location.pathname).toBe("/edit")

    await user.click(screen.getByRole("button", { name: i18n.t("fullPage.leave") }))
    expect(await screen.findByText("other")).toBeInTheDocument()
  })

  it("lets the pathname change through when clean", async () => {
    const user = userEvent.setup()
    renderGuard(false)

    await user.click(screen.getByRole("link", { name: "other page" }))

    expect(await screen.findByText("other")).toBeInTheDocument()
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
  })
})
