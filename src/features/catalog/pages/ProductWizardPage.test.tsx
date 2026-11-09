import { render, screen } from "@testing-library/react"
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

    await user.click(screen.getByRole("button", { name: i18n.t("catalog.productWizard.back") }))
    expect(router.state.location.search).toBe("?passo=offer")
  })

  it("opens a later step from the query without showing the others", async () => {
    renderWizard(`/catalogo/produtos/${PRODUCT_ID}/assistente?passo=resource`)
    expect(await screen.findByRole("heading", { name: i18n.t("catalog.productWizard.steps.resource") })).toBeInTheDocument()
    expect(screen.queryByRole("textbox", { name: i18n.t("catalog.products.form.name") })).not.toBeInTheDocument()
  })
})
