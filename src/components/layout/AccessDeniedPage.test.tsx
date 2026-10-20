import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createMemoryRouter, RouterProvider } from "react-router-dom"
import { describe, expect, it } from "vitest"
import i18n from "@/lib/i18n"
import { AccessDeniedPage } from "./AccessDeniedPage"

describe("AccessDeniedPage", () => {
  it.each([false, true])("goes back with prior history: %s", async (hasHistory) => {
    const router = createMemoryRouter([
      { path: "/", element: <p>home</p> },
      { path: "/previous", element: <p>previous</p> },
      { path: "/denied", element: <AccessDeniedPage /> },
    ], { initialEntries: hasHistory ? ["/previous", "/denied"] : ["/denied"], initialIndex: hasHistory ? 1 : 0 })
    render(<RouterProvider router={router} />)
    await userEvent.setup().click(screen.getByRole("button", { name: i18n.t("common.back") }))
    expect(router.state.location.pathname).toBe(hasHistory ? "/previous" : "/")
  })
})
