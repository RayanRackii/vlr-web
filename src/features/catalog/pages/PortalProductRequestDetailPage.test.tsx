import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { MemoryRouter, Outlet, Route, Routes } from "react-router-dom"

import { PortalProductRequestDetailPage } from "@/features/catalog/pages/PortalProductRequestDetailPage"
import type { PortalProductRequest } from "@/features/catalog/schemas/catalogSchemas"
import type { CustomerAppOutletContext } from "@/features/tenantPortal/components/CustomerAppLayout"
import i18n from "@/lib/i18n"

vi.mock("@/features/catalog/services/catalogPortalService", () => ({
  getPortalProductRequest: vi.fn(),
  getPortalCatalogPolicy: vi.fn(),
  cancelPortalProductRequest: vi.fn(),
}))

import { getPortalCatalogPolicy, cancelPortalProductRequest, getPortalProductRequest } from "@/features/catalog/services/catalogPortalService"

const getMock = vi.mocked(getPortalProductRequest)

const REQUEST_ID = "3fa85f64-5717-4562-b3fc-2c963f66afa6"

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

const request: PortalProductRequest = {
  id: REQUEST_ID,
  status: "Quoted",
  description: "Replacement gasket",
  quantity: 2,
  createdAt: "2026-10-18T16:00:00+00:00",
  files: [
    {
      id: "7c9e6679-7425-40de-944b-e07fc1f90ae7",
      fileName: "gasket.pdf",
      url: "https://signed.example/catalog-private/gasket.pdf",
    },
    {
      id: "8c9e6679-7425-40de-944b-e07fc1f90ae7",
      fileName: "notes.txt",
      url: "javascript:alert(1)",
    },
  ],
}

function renderDetail() {
  return render(
    <MemoryRouter
      initialEntries={[`/t/ficc/catalogo/solicitacoes/${REQUEST_ID}`]}
    >
      <Routes>
        <Route path="/t/:subdomain" element={<Outlet context={outletContext} />}>
          <Route
            path="catalogo/solicitacoes"
            element={<p>list-screen</p>}
          />
          <Route
            path="catalogo/solicitacoes/:requestId"
            element={<PortalProductRequestDetailPage />}
          />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe("PortalProductRequestDetailPage", () => {
  beforeEach(() => {
    vi.mocked(getPortalCatalogPolicy).mockResolvedValue({ canCancelOrders: true, canCancelRequests: true, upToStatus: { orders: "Requested", requests: "Submitted" }, policyText: "Sem reembolso." })
    getMock.mockReset()
  })

  it("shows the request, a file link, and leaves a non-http file as text", async () => {
    let resolveRequest: (value: PortalProductRequest) => void = () => {
      throw new Error("missing resolve")
    }
    getMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRequest = resolve
        }),
    )
    renderDetail()

    expect(screen.getByRole("status")).toBeInTheDocument()
    resolveRequest(request)

    expect(await screen.findByText("Replacement gasket")).toBeInTheDocument()
    expect(screen.getByText("Quoted")).toBeInTheDocument()
    expect(
      screen.getByText(`${i18n.t("tenantPortal.catalog.quantity")}: 2`),
    ).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "gasket.pdf" })).toHaveAttribute(
      "href",
      "https://signed.example/catalog-private/gasket.pdf",
    )
    expect(screen.getByText("notes.txt").closest("a")).toBeNull()
    expect(getMock).toHaveBeenCalledWith(REQUEST_ID)
  })

  it.each(["note", "observation"] as const)("shows the submitted %s", async (field) => {
    getMock.mockResolvedValue({ ...request, [field]: "Deliver at reception" })
    renderDetail()
    expect(await screen.findByText("Deliver at reception")).toBeInTheDocument()
    expect(screen.getByText(i18n.t("tenantPortal.catalog.requestNote"))).toBeInTheDocument()
  })

  it("shows an empty file list", async () => {
    getMock.mockResolvedValue({ ...request, files: [], status: "Submitted" })
    renderDetail()

    expect(
      await screen.findByText(i18n.t("tenantPortal.catalog.requestFilesEmpty")),
    ).toBeInTheDocument()
    expect(screen.getByText("Enviada")).toBeInTheDocument()
  })

  it("shows not found for another customer and can retry", async () => {
    const user = userEvent.setup()
    getMock.mockRejectedValueOnce(
      new Error(i18n.t("tenantPortal.catalog.requestNotFound")),
    )
    getMock.mockResolvedValueOnce({ ...request, files: [], status: "Submitted" })
    renderDetail()

    expect(await screen.findByRole("alert")).toHaveTextContent(
      i18n.t("tenantPortal.catalog.requestNotFound"),
    )
    expect(screen.queryByText("Replacement gasket")).not.toBeInTheDocument()

    await user.click(
      screen.getByRole("button", { name: i18n.t("catalog.retry") }),
    )
    expect(await screen.findByText("Replacement gasket")).toBeInTheDocument()
    expect(getMock).toHaveBeenCalledTimes(2)
  })

  it("cancels a submitted request, shows the policy and preserves signed files", async () => {
    getMock.mockResolvedValue({ ...request, status: "Submitted" })
    vi.mocked(cancelPortalProductRequest).mockResolvedValue({ id: REQUEST_ID, customerId: REQUEST_ID, description: request.description, quantity: 2, note: null, status: "Cancelled", createdAt: request.createdAt, files: [] })
    const user = userEvent.setup()
    renderDetail()
    await user.click(await screen.findByRole("button", { name: i18n.t("tenantPortal.catalog.cancelRequest") }))
    expect(await screen.findByText("Sem reembolso.")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: i18n.t("tenantPortal.catalog.cancelConfirmAction") }))
    expect(await screen.findByText(i18n.t("catalog.productRequestStatus.Cancelled"))).toBeInTheDocument()
    expect(cancelPortalProductRequest).toHaveBeenCalledWith(REQUEST_ID)
    expect(screen.getByRole("link", { name: "gasket.pdf" })).toHaveAttribute("href", "https://signed.example/catalog-private/gasket.pdf")
    expect(screen.queryByRole("button", { name: i18n.t("tenantPortal.catalog.cancelRequest") })).not.toBeInTheDocument()
  })

  it("returns to the list", async () => {
    const user = userEvent.setup()
    getMock.mockResolvedValue({ ...request, files: [] })
    renderDetail()
    await screen.findByText("Replacement gasket")

    await user.click(screen.getByRole("link", { name: i18n.t("common.back") }))
    expect(screen.getByText("list-screen")).toBeInTheDocument()
  })
})
