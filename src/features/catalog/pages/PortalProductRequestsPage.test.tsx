import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { MemoryRouter, Outlet, Route, Routes } from "react-router-dom"

import { PortalCatalogPage } from "@/features/catalog/pages/PortalCatalogPage"
import { PortalProductRequestsPage } from "@/features/catalog/pages/PortalProductRequestsPage"
import type { PortalProductRequestPage } from "@/features/catalog/schemas/catalogSchemas"
import type { PortalProductRequestListResult } from "@/features/catalog/services/catalogPortalService"
import type { CustomerAppOutletContext } from "@/features/tenantPortal/components/CustomerAppLayout"
import i18n from "@/lib/i18n"

vi.mock("@/features/catalog/services/catalogPortalService", () => ({
  listPortalProductRequests: vi.fn(),
  listPortalCatalogProducts: vi.fn(),
}))

import {
  listPortalCatalogProducts,
  listPortalProductRequests,
} from "@/features/catalog/services/catalogPortalService"

const listMock = vi.mocked(listPortalProductRequests)
const listProductsMock = vi.mocked(listPortalCatalogProducts)

const outletContext: CustomerAppOutletContext = {
  subdomain: "ficc",
  branding: {
    subdomain: "ficc",
    displayName: "FICC",
    logoSvg: null,
    primaryColor: "#123456",
    accentColor: null,
    welcomeTagline: null,
  },
  primary: "#123456",
  menu: [],
}

const FIRST_ID = "11111111-1111-4111-8111-111111111111"
const SECOND_ID = "22222222-2222-4222-8222-222222222222"

function pageOf(
  description: string,
  id: string,
  page: number,
  total: number,
): PortalProductRequestPage {
  return {
    items: [
      {
        id,
        status: "Submitted",
        description,
        quantity: 2,
        createdAt: "2026-10-18T16:00:00+00:00",
        files: [],
      },
    ],
    page,
    pageSize: 1,
    total,
  }
}

function ready(
  page: PortalProductRequestPage,
): PortalProductRequestListResult {
  return { kind: "ready", page }
}

function renderList() {
  return render(
    <MemoryRouter initialEntries={["/t/ficc/catalogo/solicitacoes"]}>
      <Routes>
        <Route path="/t/:subdomain" element={<Outlet context={outletContext} />}>
          <Route
            path="catalogo/solicitacoes"
            element={<PortalProductRequestsPage />}
          />
          <Route
            path="catalogo/solicitacoes/:requestId"
            element={<p>detail-screen</p>}
          />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe("PortalProductRequestsPage", () => {
  beforeEach(() => {
    listMock.mockReset()
    listProductsMock.mockReset()
    listProductsMock.mockResolvedValue([])
  })

  afterEach(async () => {
    await i18n.changeLanguage("pt-BR")
  })

  it("shows a loading state and then the newest request", async () => {
    let resolvePage: (result: PortalProductRequestListResult) => void = () => {
      throw new Error("missing resolve")
    }
    listMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePage = resolve
        }),
    )
    renderList()

    expect(
      screen.getByRole("status", {
        name: i18n.t("tenantPortal.catalog.requestsLoading"),
      }),
    ).toBeInTheDocument()

    resolvePage(ready(pageOf("Replacement gasket", FIRST_ID, 1, 1)))

    expect(await screen.findByText("Replacement gasket")).toBeInTheDocument()
    const chip = screen.getByText("Enviada")
    expect(chip).toHaveClass("portal-chip", "portal-chip-info")
    const card = screen.getByRole("link", {
      name: /Replacement gasket\s*Enviada\s*18\/10\/2026/,
    })
    expect(within(card).getByText(/\b2\b/)).toBeInTheDocument()
    expect(
      screen.queryByRole("status", {
        name: i18n.t("tenantPortal.catalog.requestsLoading"),
      }),
    ).not.toBeInTheDocument()
    expect(listMock).toHaveBeenCalledWith(1)
  })

  it("shows the empty inbox only when the list responds with no rows", async () => {
    listMock.mockResolvedValue(
      ready({
        items: [],
        page: 1,
        pageSize: 20,
        total: 0,
      }),
    )
    renderList()

    expect(
      await screen.findByText(i18n.t("tenantPortal.catalog.requestsEmpty")),
    ).toBeInTheDocument()
    expect(
      screen.queryByText(i18n.t("tenantPortal.catalog.requestsUnavailable")),
    ).not.toBeInTheDocument()
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    expect(screen.getByText(i18n.t("emptyStates.examples.portalRequests"))).toBeVisible()
    expect(screen.getByRole("link", { name: i18n.t("tenantPortal.catalog.requestCta") })).toHaveAttribute("href", "/t/ficc/catalogo/solicitar")
  })

  it("shows unavailable instead of an empty inbox when the list endpoint is missing", async () => {
    listMock.mockResolvedValue({ kind: "unavailable" })
    renderList()

    expect(
      await screen.findByText(i18n.t("tenantPortal.catalog.requestsUnavailable")),
    ).toBeInTheDocument()
    expect(
      screen.queryByText(i18n.t("tenantPortal.catalog.requestsEmpty")),
    ).not.toBeInTheDocument()
    expect(screen.queryByRole("table")).not.toBeInTheDocument()
  })

  it("shows an error and retries without leaving the page", async () => {
    const user = userEvent.setup()
    listMock.mockRejectedValueOnce(new Error("Não foi possível carregar suas solicitações."))
    listMock.mockResolvedValueOnce(
      ready({
        items: [],
        page: 1,
        pageSize: 20,
        total: 0,
      }),
    )
    renderList()

    expect(
      await screen.findByRole("alert"),
    ).toHaveTextContent("Não foi possível carregar suas solicitações.")
    expect(
      screen.queryByText(i18n.t("tenantPortal.catalog.requestsEmpty")),
    ).not.toBeInTheDocument()

    await user.click(
      screen.getByRole("button", { name: i18n.t("catalog.retry") }),
    )

    expect(
      await screen.findByText(i18n.t("tenantPortal.catalog.requestsEmpty")),
    ).toBeInTheDocument()
    expect(listMock).toHaveBeenCalledTimes(2)
  })

  it("pages newest first and opens the detail screen", async () => {
    const user = userEvent.setup()
    listMock.mockImplementation(async (page?: number) => {
      if (page === 2) {
        return ready(pageOf("Second gasket", SECOND_ID, 2, 2))
      }
      return ready(pageOf("First gasket", FIRST_ID, 1, 2))
    })
    renderList()

    expect(await screen.findByText("First gasket")).toBeInTheDocument()
    expect(
      screen.getByText(i18n.t("tenantPortal.catalog.requestsPageSummary", {
        from: 1,
        to: 1,
        total: 2,
      })),
    ).toBeInTheDocument()

    await user.click(
      screen.getByRole("button", {
        name: i18n.t("tenantPortal.catalog.requestsNext"),
      }),
    )

    expect(await screen.findByText("Second gasket")).toBeInTheDocument()
    expect(screen.queryByText("First gasket")).not.toBeInTheDocument()
    await waitFor(() => {
      expect(listMock).toHaveBeenCalledWith(2)
    })

    await user.click(screen.getByRole("link", { name: /Second gasket\s*Enviada/ }))
    expect(screen.getByText("detail-screen")).toBeInTheDocument()
  })

  it("recovers from an empty later page without treating the inbox as new", async () => {
    const user = userEvent.setup()
    listMock.mockImplementation(async (page) => page === 2
      ? ready({ items: [], page: 2, pageSize: 1, total: 2 })
      : ready(pageOf("First gasket", FIRST_ID, 1, 2)))
    renderList()
    await screen.findByText("First gasket")
    await user.click(screen.getByRole("button", { name: i18n.t("tenantPortal.catalog.requestsNext") }))
    expect(await screen.findByText(i18n.t("tenantPortal.catalog.requestsPageEmpty"))).toBeVisible()
    expect(screen.queryByText(i18n.t("emptyStates.examples.portalRequests"))).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: i18n.t("emptyStates.firstPage") }))
    expect(await screen.findByText("First gasket")).toBeVisible()
  })

  it("translates the status when the language changes", async () => {
    listMock.mockResolvedValue(ready(pageOf("Replacement gasket", FIRST_ID, 1, 1)))
    renderList()
    expect(await screen.findByText("Enviada")).toBeInTheDocument()

    await i18n.changeLanguage("en")
    expect(await screen.findByText("Submitted")).toBeInTheDocument()

    await i18n.changeLanguage("es")
    expect(await screen.findByText("Enviada")).toBeInTheDocument()
  })
})

describe("PortalCatalogPage requests link", () => {
  beforeEach(() => {
    listProductsMock.mockReset()
    listProductsMock.mockResolvedValue([])
  })

  it("links Minhas solicitações from the catalog actions", async () => {
    render(
      <MemoryRouter initialEntries={["/t/ficc/catalogo"]}>
        <Routes>
          <Route path="/t/:subdomain" element={<Outlet context={outletContext} />}>
            <Route path="catalogo" element={<PortalCatalogPage />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    expect(
      await screen.findByRole("link", {
        name: i18n.t("tenantPortal.catalog.navRequests"),
      }),
    ).toHaveAttribute("href", "/t/ficc/catalogo/solicitacoes")
  })
})
