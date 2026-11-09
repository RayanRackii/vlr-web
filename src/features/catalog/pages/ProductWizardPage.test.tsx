import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { createMemoryRouter, RouterProvider } from "react-router-dom"

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
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false)
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
      expect(confirm).toHaveBeenCalledWith(i18n.t("fullPage.leaveConfirm"))
      expect(router.state.location.search).toBe("?passo=offer")
      expect(name).toHaveValue("Kit festa revisado")
      expect(window.dispatchEvent(new Event("beforeunload", { cancelable: true }))).toBe(false)

      const products = screen.getAllByRole("link", { name: i18n.t("catalog.products.title") })[0]
      if (!products) {
        throw new Error("missing products link")
      }
      fireEvent.click(products, { ctrlKey: true })
      fireEvent.click(products, { metaKey: true })
      expect(confirm).toHaveBeenCalledTimes(1)
      expect(router.state.location.pathname).toContain("/assistente")

      const stepper = screen.getAllByRole("button", { name: i18n.t("catalog.productWizard.steps.access") })
        .find((button) => !button.hasAttribute("disabled"))
      if (!stepper) {
        throw new Error("missing access step")
      }
      await user.click(stepper)
      expect(router.state.location.search).toBe("?passo=offer")

      confirm.mockReturnValue(true)
      await user.click(screen.getByRole("button", { name: i18n.t("catalog.productWizard.next") }))
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
    await waitFor(() => expect(vi.mocked(getCatalogProduct).mock.calls.length).toBeGreaterThan(before))
    const status = screen.getAllByRole("button", { name: i18n.t("catalog.productWizard.steps.status") })
      .find((button) => !button.hasAttribute("disabled"))
    if (!status) {
      throw new Error("missing status step")
    }
    await user.click(status)
    expect(await screen.findByText(i18n.t("catalog.productWizard.details.resource.done"))).toBeInTheDocument()
    expect(screen.queryByText(i18n.t("catalog.productWizard.details.resource.missing"))).not.toBeInTheDocument()
  })

  it("opens a later step from the query without showing the others", async () => {
    renderWizard(`/catalogo/produtos/${PRODUCT_ID}/assistente?passo=resource`)
    expect(await screen.findByRole("heading", { name: i18n.t("catalog.productWizard.steps.resource") })).toBeInTheDocument()
    expect(screen.queryByRole("textbox", { name: i18n.t("catalog.products.form.name") })).not.toBeInTheDocument()
  })
})
