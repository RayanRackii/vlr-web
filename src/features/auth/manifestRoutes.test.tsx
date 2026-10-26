import { render, screen } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { describe, expect, it } from "vitest"

import i18n from "@/lib/i18n"
import { authManifest } from "@/features/auth/manifest"

function renderAuthRoutes(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        {authManifest.routes.public.map((route) => (
          <Route key={route.path} path={route.path} element={route.element} />
        ))}
      </Routes>
    </MemoryRouter>,
  )
}

describe("authManifest public routes", () => {
  it("routes /forgot-password to the login screen instead of 404ing", async () => {
    renderAuthRoutes("/forgot-password")

    expect(
      await screen.findByRole("heading", { name: i18n.t("auth.login.title") }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: i18n.t("auth.login.forgotPassword") }),
    ).toBeInTheDocument()
  })
})
