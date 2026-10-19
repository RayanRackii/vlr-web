import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { toast } from "sonner"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { MemoryRouter, Outlet, Route, Routes } from "react-router-dom"

import { PortalProductRequestPage } from "@/features/catalog/pages/PortalProductRequestPage"
import type { ProductRequest } from "@/features/catalog/schemas/catalogSchemas"
import { tenantPortalPath } from "@/features/tenantPortal/services/tenantPortalService"
import type { CustomerAppOutletContext } from "@/features/tenantPortal/components/CustomerAppLayout"
import i18n from "@/lib/i18n"

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock("@/features/catalog/services/catalogPortalService", () => ({
  createPortalProductRequest: vi.fn(),
}))

import { createPortalProductRequest } from "@/features/catalog/services/catalogPortalService"

const createRequestMock = vi.mocked(createPortalProductRequest)
const toastError = vi.mocked(toast.error)
const toastSuccess = vi.mocked(toast.success)

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

function renderRequest() {
  return render(
    <MemoryRouter>
      <Routes>
        <Route element={<Outlet context={outletContext} />}>
          <Route path="/" element={<PortalProductRequestPage />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

function replaceValue(element: HTMLElement, value: string) {
  fireEvent.change(element, { target: { value } })
}

describe("PortalProductRequestPage validity gate", () => {
  beforeEach(() => {
    createRequestMock.mockReset()
    toastError.mockReset()
    toastSuccess.mockReset()
  })

  it("keeps Enviar solicitação disabled until the request schema passes and leaves Voltar, quantity and files free", async () => {
    const user = userEvent.setup()
    const { container } = renderRequest()

    const submit = () =>
      screen.getByRole("button", {
        name: i18n.t("tenantPortal.catalog.requestSubmit"),
      })
    const back = screen.getByRole("link", { name: i18n.t("common.back") })
    const description = screen.getByLabelText(
      i18n.t("tenantPortal.catalog.requestDescription"),
    )
    const quantity = screen.getByRole("spinbutton", {
      name: i18n.t("tenantPortal.catalog.quantity"),
    })
    const note = screen.getByLabelText(i18n.t("tenantPortal.catalog.requestNote"))
    const files = container.querySelector('input[type="file"]')
    expect(files).toBeInstanceOf(HTMLInputElement)

    expect(submit()).toBeDisabled()
    expect(back).toBeEnabled()
    expect(quantity).toBeEnabled()
    expect(files).toBeEnabled()
    expect(createRequestMock).not.toHaveBeenCalled()

    await user.type(description, "   ")
    expect(submit()).toBeDisabled()
    expect(back).toBeEnabled()
    expect(quantity).toBeEnabled()

    await user.clear(description)
    await user.type(description, "Rede de vôlei")
    expect(submit()).toBeEnabled()
    expect(back).toBeEnabled()
    expect(files).toBeEnabled()

    replaceValue(description, "d".repeat(2001))
    expect(submit()).toBeDisabled()
    expect(quantity).toBeEnabled()
    replaceValue(description, "Rede de vôlei")
    expect(submit()).toBeEnabled()

    replaceValue(quantity, "0")
    expect(submit()).toBeDisabled()
    expect(quantity).toBeEnabled()
    expect(back).toBeEnabled()
    replaceValue(quantity, "1")
    expect(submit()).toBeEnabled()

    replaceValue(quantity, "10000")
    expect(submit()).toBeDisabled()
    replaceValue(quantity, "12")
    expect(submit()).toBeEnabled()

    replaceValue(note, "n".repeat(2001))
    expect(submit()).toBeDisabled()
    expect(files).toBeEnabled()
    expect(back).toBeEnabled()
    replaceValue(note, "Cor azul")
    expect(note).toHaveValue("Cor azul")
    expect(submit()).toBeEnabled()
    expect(createRequestMock).not.toHaveBeenCalled()
  })

  it("re-enables Enviar solicitação after a server error and keeps the entered values", async () => {
    const user = userEvent.setup()
    let rejectRequest: (reason: Error) => void = () => {
      throw new Error("missing reject")
    }
    createRequestMock.mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          rejectRequest = reject
        }),
    )
    renderRequest()

    const description = screen.getByLabelText(
      i18n.t("tenantPortal.catalog.requestDescription"),
    )
    const quantity = screen.getByRole("spinbutton", {
      name: i18n.t("tenantPortal.catalog.quantity"),
    })
    const note = screen.getByLabelText(i18n.t("tenantPortal.catalog.requestNote"))
    await user.type(description, "Rede de vôlei")
    replaceValue(quantity, "3")
    await user.type(note, "Cor azul")

    const submit = screen.getByRole("button", {
      name: i18n.t("tenantPortal.catalog.requestSubmit"),
    })
    expect(submit).toBeEnabled()
    expect(screen.getByRole("link", { name: i18n.t("common.back") })).toBeEnabled()
    await user.click(submit)

    await waitFor(() => {
      expect(
        screen.getByRole("button", {
          name: i18n.t("tenantPortal.catalog.submitting"),
        }),
      ).toBeDisabled()
    })

    rejectRequest(new Error("Não foi possível enviar a solicitação."))

    await waitFor(() => {
      expect(
        screen.getByRole("button", {
          name: i18n.t("tenantPortal.catalog.requestSubmit"),
        }),
      ).toBeEnabled()
    })
    expect(toastError).toHaveBeenCalledWith("Não foi possível enviar a solicitação.")
    expect(description).toHaveValue("Rede de vôlei")
    expect(quantity).toHaveValue(3)
    expect(note).toHaveValue("Cor azul")
    expect(screen.getByRole("link", { name: i18n.t("common.back") })).toBeEnabled()
    expect(createRequestMock).toHaveBeenCalledTimes(1)
  })

  it("confirms the sent request and links Minhas solicitações", async () => {
    const user = userEvent.setup()
    const created: ProductRequest = {
      id: "77777777-7777-4777-8777-777777777777",
      customerId: "88888888-8888-4888-8888-888888888888",
      description: "Rede de vôlei",
      quantity: 2,
      note: "Cor azul",
      status: "Submitted",
      createdAt: "2026-10-18T15:00:00.000Z",
      files: [],
    }
    createRequestMock.mockResolvedValue(created)
    renderRequest()

    expect(
      screen.queryByRole("link", {
        name: i18n.t("tenantPortal.catalog.navRequests"),
      }),
    ).not.toBeInTheDocument()

    await user.type(
      screen.getByLabelText(i18n.t("tenantPortal.catalog.requestDescription")),
      "Rede de vôlei",
    )
    await user.type(
      screen.getByLabelText(i18n.t("tenantPortal.catalog.requestNote")),
      "Cor azul",
    )
    await user.click(
      screen.getByRole("button", {
        name: i18n.t("tenantPortal.catalog.requestSubmit"),
      }),
    )

    expect(
      await screen.findByRole("heading", {
        name: i18n.t("tenantPortal.catalog.requestSentTitle"),
      }),
    ).toBeInTheDocument()
    const body = screen.getByText(i18n.t("tenantPortal.catalog.requestSentBody"))
    expect(body).toBeInTheDocument()
    expect(body).not.toHaveTextContent(/não lista|does not list|no lista/i)
    expect(screen.getByRole("status")).toHaveTextContent("Rede de vôlei")
    expect(screen.getByRole("status")).toHaveTextContent("Cor azul")
    expect(screen.getByRole("status")).toHaveTextContent(
      `${i18n.t("tenantPortal.catalog.quantity")}: 2`,
    )
    expect(
      screen.getByRole("link", {
        name: i18n.t("tenantPortal.catalog.navRequests"),
      }),
    ).toHaveAttribute(
      "href",
      tenantPortalPath("ficc", "catalogo/solicitacoes"),
    )
    expect(
      screen.getByRole("link", {
        name: i18n.t("tenantPortal.catalog.requestSentCatalog"),
      }),
    ).toHaveAttribute("href", tenantPortalPath("ficc", "catalogo"))
    expect(
      screen.queryByRole("button", {
        name: i18n.t("tenantPortal.catalog.requestSubmit"),
      }),
    ).not.toBeInTheDocument()
    expect(toastSuccess).toHaveBeenCalledWith(
      i18n.t("tenantPortal.catalog.requestSubmitted"),
    )
    expect(createRequestMock).toHaveBeenCalledTimes(1)
  })
})
