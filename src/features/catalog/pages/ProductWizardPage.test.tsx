import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { createMemoryRouter, Link, RouterProvider } from "react-router-dom"

import { ProductWizardPage } from "@/features/catalog/pages/ProductWizardPage"
import { TestPermissionProvider } from "@/features/users/permissions/PermissionContext"
import i18n from "@/lib/i18n"

vi.mock("@/features/users/hooks/useTrialStatus", () => ({
  useTrialStatus: () => ({
    isLoading: false,
    isTrial: false,
    isTrialReadOnly: false,
    trialEndsAt: undefined,
    trialPurgeAt: undefined,
  }),
}))

vi.mock("@/features/catalog/services/catalogService", () => ({
  getCatalogProduct: vi.fn(),
  getCatalogProductAccess: vi.fn(),
  getCatalogProductResourceRequirements: vi.fn(),
  listCustomerGroups: vi.fn(),
  updateCatalogProduct: vi.fn(),
  activateCatalogProduct: vi.fn(),
  deactivateCatalogProduct: vi.fn(),
  putCatalogProductAccess: vi.fn(),
  addCustomerGroupMembers: vi.fn(),
  replaceCatalogProductResourceRequirements: vi.fn(),
}))

vi.mock("@/features/tenantPortal/services/tenantPortalService", () => ({
  listTenantModuleMenuItems: vi.fn(),
  createModuleMenuItem: vi.fn(),
  updateModuleMenuItem: vi.fn(),
}))

vi.mock("@/features/rentals/services/scheduleService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/rentals/services/scheduleService")>()
  return { ...actual, listAdminRentalAssets: vi.fn() }
})

import {
  getCatalogProduct,
  getCatalogProductAccess,
  getCatalogProductResourceRequirements,
  listCustomerGroups,
  replaceCatalogProductResourceRequirements,
  updateCatalogProduct,
} from "@/features/catalog/services/catalogService"
import { listTenantModuleMenuItems } from "@/features/tenantPortal/services/tenantPortalService"
import { listAdminRentalAssets } from "@/features/rentals/services/scheduleService"

const PRODUCT_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"

function renderWizard(path = `/catalogo/produtos/${PRODUCT_ID}/assistente`) {
  const router = createMemoryRouter([
    {
      path: "/catalogo/produtos/:id/assistente",
      element: (
        <TestPermissionProvider
          permissions={[
            "catalog.products.read",
            "catalog.products.manage",
            "core.module_menu.read",
            "core.module_menu.write",
            "core.customers.read",
          ]}
          activeModules={["catalog", "rentals"]}
        >
          <ProductWizardPage />
        </TestPermissionProvider>
      ),
    },
    { path: "/catalogo/produtos", element: <h1>Lista</h1> },
  ], { initialEntries: [path] })
  render(<RouterProvider router={router} />)
  return router
}

describe("ProductWizardPage", () => {
  beforeEach(() => {
    vi.mocked(getCatalogProduct).mockResolvedValue({
      id: PRODUCT_ID,
      name: "Kit festa",
      code: "FESTA-01",
      description: null,
      price: 10,
      currency: "BRL",
      isActive: true,
      createdAt: "2026-11-09T12:00:00.000Z",
      files: [],
      visibility: "Restricted",
    } as never)
    vi.mocked(getCatalogProductAccess).mockResolvedValue({
      productId: PRODUCT_ID,
      visibility: "Restricted",
      customerIds: [],
      groupIds: ["group-1"],
      restrictedWithoutGrants: false,
    })
    vi.mocked(listCustomerGroups).mockResolvedValue([
      {
        id: "group-1",
        name: "Sócios",
        description: null,
        memberCustomerIds: [],
        createdAt: "2026-11-09T12:00:00.000Z",
        updatedAt: null,
      },
    ])
    vi.mocked(listTenantModuleMenuItems).mockResolvedValue([])
    vi.mocked(listAdminRentalAssets).mockResolvedValue([])
    vi.mocked(getCatalogProductResourceRequirements).mockResolvedValue({
      expectedVersion: 1,
      requirements: [{ rentalAssetId: null, assetCategoryId: null, resourceQuantity: 1, durationMinutesPerUnit: 60, prepMinutes: 0, cleanupMinutes: 0 }],
    })
  })

  it("uses the checklist rows for the status badge", async () => {
    vi.mocked(getCatalogProduct).mockResolvedValue({
      id: PRODUCT_ID,
      name: "Kit festa",
      code: "FESTA-01",
      description: null,
      price: null,
      currency: "BRL",
      isActive: true,
      createdAt: "2026-11-09T12:00:00.000Z",
      files: [],
      visibility: "Public",
    } as never)
    vi.mocked(getCatalogProductAccess).mockResolvedValue({
      productId: PRODUCT_ID,
      visibility: "Public",
      customerIds: [],
      groupIds: [],
      restrictedWithoutGrants: false,
    })
    vi.mocked(listTenantModuleMenuItems).mockResolvedValue([{ moduleName: "catalog", isActive: true }] as never)
    vi.mocked(getCatalogProductResourceRequirements).mockResolvedValue({ expectedVersion: 1, requirements: [] })
    renderWizard()
    expect(await screen.findByText(i18n.t("assistant.status.published"))).toBeInTheDocument()
    expect(screen.queryByText(/Falta \d+ passos/)).not.toBeInTheDocument()
    const labels = screen.getAllByText(i18n.t("catalog.productWizard.statusLabel.done"))
    expect(labels.length).toBeGreaterThan(0)
    expect(screen.queryByText(i18n.t("catalog.productWizard.statusLabel.missing"))).not.toBeInTheDocument()
  })

  it("shows the blockers and moves one step at a time", async () => {
    const user = userEvent.setup()
    const router = renderWizard()
    expect(await screen.findByRole("heading", { name: i18n.t("catalog.productWizard.title") })).toBeInTheDocument()
    expect(screen.getByText(i18n.t("catalog.productWizard.details.audience.missing"))).toBeInTheDocument()
    expect(screen.getByText(i18n.t("catalog.productWizard.details.portalMenu.missing"))).toBeInTheDocument()
    expect(screen.getByText(i18n.t("catalog.productWizard.details.resource.missing"))).toBeInTheDocument()
    expect(screen.queryByRole("textbox", { name: i18n.t("catalog.products.form.name") })).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: i18n.t("catalog.productWizard.next") }))
    expect(router.state.location.search).toBe("?passo=offer")
    expect(await screen.findByRole("textbox", { name: i18n.t("catalog.products.form.name") })).toBeInTheDocument()
    expect(screen.queryByText(i18n.t("catalog.productWizard.details.audience.missing"))).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: i18n.t("catalog.productWizard.next") }))
    expect(router.state.location.search).toBe("?passo=access")
    expect(await screen.findByRole("button", { name: i18n.t("catalog.products.visibilityFilter.restricted") })).toHaveAttribute("aria-pressed", "true")
    expect(decodeURIComponent(screen.getByRole("link", { name: i18n.t("catalog.productWizard.actions.openGroup") }).getAttribute("href") ?? "")).toContain(
      "/assistente?passo=access",
    )

    await user.click(screen.getByRole("button", { name: i18n.t("catalog.productWizard.back") }))
    expect(router.state.location.search).toBe("?passo=offer")
  })

  it("keeps an unsaved offer until the leave is confirmed, and ignores modified clicks", async () => {
    const confirm = vi.spyOn(window, "confirm")
    const user = userEvent.setup()
    try {
      const router = renderWizard()
      await user.click(await screen.findByRole("button", { name: i18n.t("catalog.productWizard.next") }))
      const name = await screen.findByRole("textbox", { name: i18n.t("catalog.products.form.name") })
      await user.clear(name)
      expect(screen.getByRole("button", { name: i18n.t("common.save") })).toBeDisabled()
      await user.type(name, "Kit festa revisado")
      expect(screen.getByRole("button", { name: i18n.t("common.save") })).toBeEnabled()
      await user.clear(await screen.findByRole("textbox", { name: i18n.t("catalog.products.form.price") }))
      await user.type(screen.getByRole("textbox", { name: i18n.t("catalog.products.form.price") }), "-1")
      expect(screen.getByRole("button", { name: i18n.t("common.save") })).toBeDisabled()
      await user.clear(screen.getByRole("textbox", { name: i18n.t("catalog.products.form.price") }))

      await user.click(screen.getByRole("button", { name: i18n.t("catalog.productWizard.next") }))
      const dialog = await screen.findByRole("alertdialog")
      expect(dialog).toHaveTextContent(i18n.t("fullPage.leaveConfirm"))
      expect(confirm).not.toHaveBeenCalled()
      await user.click(within(dialog).getByRole("button", { name: i18n.t("common.cancel") }))
      expect(router.state.location.search).toBe("?passo=offer")
      expect(name).toHaveValue("Kit festa revisado")
      expect(window.dispatchEvent(new Event("beforeunload", { cancelable: true }))).toBe(false)

      const products = screen.getAllByRole("link", { name: i18n.t("catalog.products.title") })[0]
      if (!products) {
        throw new Error("missing products link")
      }
      fireEvent.click(products, { ctrlKey: true })
      fireEvent.click(products, { metaKey: true })
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
      expect(router.state.location.pathname).toContain("/assistente")

      const stepper = screen.getAllByRole("button", { name: i18n.t("catalog.productWizard.steps.access") })
        .find((button) => !button.hasAttribute("disabled"))
      if (!stepper) {
        throw new Error("missing access step")
      }
      await user.click(stepper)
      await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: i18n.t("common.cancel") }))
      expect(router.state.location.search).toBe("?passo=offer")

      await user.click(screen.getByRole("button", { name: i18n.t("catalog.productWizard.next") }))
      await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: i18n.t("fullPage.leave") }))
      expect(router.state.location.search).toBe("?passo=access")
      expect(window.dispatchEvent(new Event("beforeunload", { cancelable: true }))).toBe(true)
    } finally {
      confirm.mockRestore()
    }
  })

  it("refreshes the checklist after the resource step is saved", async () => {
    const assetId = "77777777-7777-4777-8777-777777777777"
    let requirements = [{
      rentalAssetId: null as string | null,
      assetCategoryId: null,
      resourceQuantity: 1,
      durationMinutesPerUnit: 60,
      prepMinutes: 0,
      cleanupMinutes: 0,
    }]
    vi.mocked(listAdminRentalAssets).mockResolvedValue([{ id: assetId, name: "Quadra society 1" }] as never)
    vi.mocked(getCatalogProductResourceRequirements).mockImplementation(async () => ({
      expectedVersion: 1,
      requirements,
    }))
    vi.mocked(replaceCatalogProductResourceRequirements).mockImplementation(async (_id, body) => {
      requirements = body.requirements.map((row) => ({
        rentalAssetId: row.rentalAssetId ?? null,
        assetCategoryId: null,
        resourceQuantity: row.resourceQuantity,
        durationMinutesPerUnit: row.durationMinutesPerUnit,
        prepMinutes: row.prepMinutes,
        cleanupMinutes: row.cleanupMinutes,
      }))
      return { expectedVersion: 2, requirements }
    })
    const user = userEvent.setup()
    renderWizard(`/catalogo/produtos/${PRODUCT_ID}/assistente?passo=resource`)
    await user.click(await screen.findByRole("button", { name: "Quadra society 1" }))
    const before = vi.mocked(getCatalogProduct).mock.calls.length
    await user.click(screen.getByRole("button", { name: i18n.t("catalog.resourcePlanning.save") }))
    await waitFor(() => {
      const status = screen.getAllByRole("button", { name: i18n.t("catalog.productWizard.steps.status") })
        .find((button) => !button.hasAttribute("disabled"))
      expect(status).toBeTruthy()
      expect(vi.mocked(getCatalogProduct).mock.calls.length).toBeGreaterThan(before)
    })
    const status = screen.getAllByRole("button", { name: i18n.t("catalog.productWizard.steps.status") })
      .find((button) => !button.hasAttribute("disabled"))
    if (!status) {
      throw new Error("missing status step")
    }
    await user.click(status)
    expect(await screen.findByText(i18n.t("catalog.productWizard.details.resource.done"))).toBeInTheDocument()
    expect(screen.queryByText(i18n.t("catalog.productWizard.details.resource.missing"))).not.toBeInTheDocument()
  })

  it("blocks Next and the stepper while the offer save is in flight, then ignores a late reload", async () => {
    const user = userEvent.setup()
    const router = renderWizard()
    await user.click(await screen.findByRole("button", { name: i18n.t("catalog.productWizard.next") }))
    const name = await screen.findByRole("textbox", { name: i18n.t("catalog.products.form.name") })
    await user.clear(name)
    await user.type(name, "Nome salvo")

    let releaseUpdate: () => void = () => {}
    vi.mocked(updateCatalogProduct).mockImplementation(() => new Promise((resolve) => {
      releaseUpdate = () => resolve({ id: PRODUCT_ID, name: "Nome salvo" } as never)
    }))
    let releaseReload: () => void = () => {}
    vi.mocked(getCatalogProduct).mockImplementation(() => new Promise((resolve) => {
      releaseReload = () => resolve({
        id: PRODUCT_ID,
        name: "Servidor antigo",
        code: "FESTA-01",
        description: null,
        price: 10,
        currency: "BRL",
        isActive: true,
        createdAt: "2026-11-09T12:00:00.000Z",
        files: [],
        visibility: "Restricted",
      } as never)
    }))

    await user.click(screen.getByRole("button", { name: i18n.t("common.save") }))
    const savingButtons = await screen.findAllByRole("button", { name: i18n.t("common.saveStatus.saving") })
    expect(savingButtons.length).toBeGreaterThan(0)
    for (const button of savingButtons) {
      expect(button).toBeDisabled()
      expect(button).toHaveAttribute("aria-busy", "true")
    }
    expect(router.state.location.search).toBe("?passo=offer")
    for (const stepName of [
      i18n.t("catalog.productWizard.steps.status"),
      i18n.t("catalog.productWizard.steps.access"),
      i18n.t("catalog.productWizard.steps.resource"),
    ]) {
      for (const button of screen.getAllByRole("button", { name: stepName })) {
        expect(button).toBeDisabled()
      }
    }

    const callsBeforeReload = vi.mocked(getCatalogProduct).mock.calls.length
    releaseUpdate()
    await waitFor(() => expect(vi.mocked(getCatalogProduct).mock.calls.length).toBeGreaterThan(callsBeforeReload))
    expect(screen.getAllByRole("button", { name: i18n.t("common.saveStatus.saving") }).every((button) => button.hasAttribute("disabled"))).toBe(true)
    expect(name).toHaveValue("Nome salvo")

    releaseReload()
    await waitFor(() => expect(screen.getByRole("button", { name: i18n.t("catalog.productWizard.next") })).toBeEnabled())
    expect(name).toHaveValue("Nome salvo")

    await user.type(name, " extra")
    vi.mocked(updateCatalogProduct).mockResolvedValue({ id: PRODUCT_ID, name: "Nome salvo extra" } as never)
    vi.mocked(getCatalogProduct).mockResolvedValue({
      id: PRODUCT_ID,
      name: "Ainda mais antigo",
      code: "FESTA-01",
      description: null,
      price: 10,
      currency: "BRL",
      isActive: true,
      createdAt: "2026-11-09T12:00:00.000Z",
      files: [],
      visibility: "Restricted",
    } as never)
    await user.click(screen.getByRole("button", { name: i18n.t("common.save") }))
    await waitFor(() => expect(screen.getByRole("button", { name: i18n.t("catalog.productWizard.next") })).toBeEnabled())
    expect(name).toHaveValue("Nome salvo extra")
  })

  it("blocks Finish while a resource save is in flight", async () => {
    const assetId = "77777777-7777-4777-8777-777777777777"
    let release: () => void = () => {}
    vi.mocked(listAdminRentalAssets).mockResolvedValue([{ id: assetId, name: "Quadra society 1" }] as never)
    vi.mocked(replaceCatalogProductResourceRequirements).mockImplementation(() => new Promise((resolve) => {
      release = () => resolve({
        expectedVersion: 2,
        requirements: [{
          rentalAssetId: assetId,
          assetCategoryId: null,
          resourceQuantity: 1,
          durationMinutesPerUnit: 60,
          prepMinutes: 0,
          cleanupMinutes: 0,
        }],
      })
    }))
    const user = userEvent.setup()
    const router = renderWizard(`/catalogo/produtos/${PRODUCT_ID}/assistente?passo=resource`)
    await user.click(await screen.findByRole("button", { name: "Quadra society 1" }))
    await user.click(screen.getByRole("button", { name: i18n.t("catalog.resourcePlanning.save") }))
    const saving = await screen.findByRole("button", { name: i18n.t("common.saveStatus.saving") })
    expect(saving).toBeDisabled()
    expect(router.state.location.search).toBe("?passo=resource")
    release()
    await waitFor(() => expect(screen.getByRole("button", { name: i18n.t("catalog.productWizard.finish") })).toBeEnabled())
  })

  it("asks before a sidebar link or the browser back leaves a dirty offer", async () => {
    const confirm = vi.spyOn(window, "confirm")
    const user = userEvent.setup()
    const offerPath = `/catalogo/produtos/${PRODUCT_ID}/assistente?passo=offer`
    const router = createMemoryRouter([
      {
        path: "/catalogo/produtos/:id/assistente",
        element: (
          <>
            <Link to="/catalogo/pedidos">{i18n.t("nav.catalogOrders")}</Link>
            <TestPermissionProvider
              permissions={[
                "catalog.products.read",
                "catalog.products.manage",
                "core.module_menu.read",
                "core.module_menu.write",
                "core.customers.read",
              ]}
              activeModules={["catalog", "rentals"]}
            >
              <ProductWizardPage />
            </TestPermissionProvider>
          </>
        ),
      },
      { path: "/catalogo/pedidos", element: <h1>Pedidos</h1> },
      { path: "/catalogo/produtos", element: <h1>Lista</h1> },
    ], { initialEntries: ["/catalogo/produtos", offerPath], initialIndex: 1 })
    render(<RouterProvider router={router} />)
    try {
      const description = await screen.findByRole("textbox", { name: i18n.t("catalog.products.form.description") })
      await user.type(description, "Nova descrição")
      const unload = new Event("beforeunload", { cancelable: true })
      expect(window.dispatchEvent(unload)).toBe(false)
      await user.click(screen.getByRole("link", { name: i18n.t("nav.catalogOrders") }))
      const dialog = await screen.findByRole("alertdialog")
      expect(dialog).toHaveTextContent(i18n.t("fullPage.leaveConfirm"))
      expect(confirm).not.toHaveBeenCalled()
      await user.click(within(dialog).getByRole("button", { name: i18n.t("common.cancel") }))
      expect(router.state.location.pathname).toContain("/assistente")
      expect(description).toHaveValue("Nova descrição")
      await act(async () => { await router.navigate(-1) })
      const backDialog = await screen.findByRole("alertdialog")
      await user.click(within(backDialog).getByRole("button", { name: i18n.t("common.cancel") }))
      expect(router.state.location.pathname).toContain("/assistente")
      expect(description).toHaveValue("Nova descrição")
    } finally {
      confirm.mockRestore()
    }
  })

  it("asks before leaving a dirty access step or a dirty resource step", async () => {
    const confirm = vi.spyOn(window, "confirm")
    const user = userEvent.setup()
    function renderAt(path: string) {
      const router = createMemoryRouter([
        {
          path: "/catalogo/produtos/:id/assistente",
          element: (
            <>
              <Link to="/catalogo/pedidos">{i18n.t("nav.catalogOrders")}</Link>
              <TestPermissionProvider
                permissions={[
                  "catalog.products.read",
                  "catalog.products.manage",
                  "core.module_menu.read",
                  "core.module_menu.write",
                  "core.customers.read",
                ]}
                activeModules={["catalog", "rentals"]}
              >
                <ProductWizardPage />
              </TestPermissionProvider>
            </>
          ),
        },
        { path: "/catalogo/pedidos", element: <h1>Pedidos</h1> },
      ], { initialEntries: [path] })
      const view = render(<RouterProvider router={router} />)
      return { router, ...view }
    }
    try {
      const access = renderAt(`/catalogo/produtos/${PRODUCT_ID}/assistente?passo=access`)
      await user.click(await screen.findByRole("button", { name: i18n.t("catalog.products.visibilityFilter.public") }))
      await user.click(screen.getByRole("link", { name: i18n.t("nav.catalogOrders") }))
      expect(await screen.findByRole("alertdialog")).toHaveTextContent(i18n.t("fullPage.leaveConfirm"))
      expect(confirm).not.toHaveBeenCalled()
      await user.click(screen.getByRole("button", { name: i18n.t("common.cancel") }))
      expect(access.router.state.location.search).toBe("?passo=access")
      access.unmount()

      const resource = renderAt(`/catalogo/produtos/${PRODUCT_ID}/assistente?passo=resource`)
      const duration = await screen.findByLabelText(i18n.t("catalog.resourcePlanning.fields.durationMinutesPerUnit"))
      fireEvent.change(duration, { target: { value: "90" } })
      await user.click(screen.getByRole("link", { name: i18n.t("nav.catalogOrders") }))
      expect(await screen.findByRole("alertdialog")).toHaveTextContent(i18n.t("fullPage.leaveConfirm"))
      await user.click(screen.getByRole("button", { name: i18n.t("common.cancel") }))
      expect(resource.router.state.location.search).toBe("?passo=resource")
      resource.unmount()
    } finally {
      confirm.mockRestore()
    }
  })

  it("opens a later step from the query without showing the others", async () => {
    renderWizard(`/catalogo/produtos/${PRODUCT_ID}/assistente?passo=resource`)
    expect(await screen.findByRole("heading", { name: i18n.t("catalog.productWizard.steps.resource") })).toBeInTheDocument()
    expect(screen.queryByRole("textbox", { name: i18n.t("catalog.products.form.name") })).not.toBeInTheDocument()
  })
})
