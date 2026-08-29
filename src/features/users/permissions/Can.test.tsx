import { render, screen } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { describe, expect, it } from "vitest"

import { PermissionRoute } from "@/components/layout/PermissionRoute"
import { AuthProvider } from "@/contexts/AuthContext"
import { Can } from "@/features/users/permissions/Can"
import { TestPermissionProvider } from "@/features/users/permissions/PermissionContext"

describe("Can", () => {
  it("renders children only when the permission is present", () => {
    render(
      <TestPermissionProvider permissions={["core.users.read"]}>
        <Can permission="core.users.read">
          <span>visible</span>
        </Can>
        <Can permission="core.users.invite">
          <span>hidden</span>
        </Can>
      </TestPermissionProvider>,
    )

    expect(screen.getByText("visible")).toBeInTheDocument()
    expect(screen.queryByText("hidden")).not.toBeInTheDocument()
  })
})

describe("PermissionRoute", () => {
  it("shows access denied when the permission is missing", async () => {
    render(
      <AuthProvider>
        <TestPermissionProvider permissions={[]}>
          <MemoryRouter initialEntries={["/pessoas-e-acesso"]}>
            <Routes>
              <Route
                element={<PermissionRoute permission="core.users.read" />}
              >
                <Route
                  path="/pessoas-e-acesso"
                  element={<div>people page</div>}
                />
              </Route>
            </Routes>
          </MemoryRouter>
        </TestPermissionProvider>
      </AuthProvider>,
    )

    expect(await screen.findByRole("heading")).toBeInTheDocument()
    expect(screen.queryByText("people page")).not.toBeInTheDocument()
  })
})
