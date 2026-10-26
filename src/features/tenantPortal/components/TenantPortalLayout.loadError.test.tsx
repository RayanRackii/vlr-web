import { render, screen, waitFor } from "@testing-library/react"
import { AxiosError } from "axios"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createMemoryRouter, RouterProvider } from "react-router-dom"
import userEvent from "@testing-library/user-event"

import { ThemeProvider } from "@/components/ThemeProvider"
import i18n from "@/lib/i18n"
import { TenantPortalLayout } from "@/features/tenantPortal/components/TenantPortalLayout"
import { PortalNotFoundRoute } from "@/features/tenantPortal/components/PortalNotFoundRoute"
import { TenantPortalLoginPage } from "@/features/tenantPortal/pages/TenantPortalLoginPage"
import { clearCustomerSession } from "@/features/tenantPortal/services/tenantPortalService"

vi.mock("@/features/tenantPortal/services/tenantPortalService", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@/features/tenantPortal/services/tenantPortalService")
    >()
  return {
    ...actual,
    fetchTenantBranding: vi.fn(() => new Promise(() => undefined)),
  }
})

import { fetchTenantBranding } from "@/features/tenantPortal/services/tenantPortalService"

const fetchBranding = vi.mocked(fetchTenantBranding)

function portalRouter(initialEntries: string[]) {
  return createMemoryRouter(
    [
      {
        path: "/t/:subdomain",
        element: <TenantPortalLayout />,
        children: [
          { index: true, element: <TenantPortalLoginPage /> },
          { path: "*", element: <PortalNotFoundRoute /> },
        ],
      },
    ],
    { initialEntries },
  )
}

function renderPortal(initialEntries: string[]) {
  render(
    <ThemeProvider>
      <RouterProvider router={portalRouter(initialEntries)} />
    </ThemeProvider>,
  )
}

function notFoundAxiosError(): AxiosError {
  return new AxiosError("Not found", "404", undefined, undefined, {
    status: 404,
    data: null,
    headers: {},
    config: {} as never,
    statusText: "Not Found",
  })
}

describe("TenantPortalLayout load failure handling", () => {
  beforeEach(() => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => undefined,
        removeListener: () => undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        dispatchEvent: () => false,
      }),
    })
    clearCustomerSession()
    fetchBranding.mockClear()
  })

  afterEach(() => {
    clearCustomerSession()
  })

  it("renders the real 404 page on an HTTP 404, not the generic unavailable message", async () => {
    fetchBranding.mockRejectedValue(notFoundAxiosError())
    renderPortal(["/t/naoexiste"])

    expect(
      await screen.findByRole("heading", { name: i18n.t("notFound.title") }),
    ).toBeInTheDocument()
    expect(
      screen.queryByText(i18n.t("tenantPortal.errors.title")),
    ).not.toBeInTheDocument()
  })

  it("shows a retry button for a non-404 failure and refetches on click", async () => {
    fetchBranding.mockRejectedValueOnce(new Error("network down"))
    renderPortal(["/t/ficc"])

    expect(
      await screen.findByText(i18n.t("tenantPortal.errors.loadFailed")),
    ).toBeInTheDocument()
    expect(fetchBranding).toHaveBeenCalledTimes(1)

    fetchBranding.mockImplementationOnce(() => new Promise(() => undefined))
    await userEvent.click(screen.getByRole("button", { name: i18n.t("tenantPortal.errors.retry") }))

    await waitFor(() => expect(fetchBranding).toHaveBeenCalledTimes(2))
  })
})
