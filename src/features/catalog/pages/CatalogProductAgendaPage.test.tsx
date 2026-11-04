import { render, screen } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { CatalogProductAgendaPage } from "@/features/catalog/pages/CatalogProductAgendaPage"
import { catalogManifest } from "@/features/catalog/manifest"
import type { CatalogAgendaItem, CatalogProduct } from "@/features/catalog/schemas/catalogSchemas"
import { TestPermissionProvider } from "@/features/users/permissions/PermissionContext"
import i18n from "@/lib/i18n"

vi.mock("@/features/catalog/services/catalogService", () => ({
  listCatalogProducts: vi.fn(),
  listCatalogProductAgenda: vi.fn(),
  getCatalogProductResourceRequirements: vi.fn(),
}))
import {
  getCatalogProductResourceRequirements,
  listCatalogProductAgenda,
  listCatalogProducts,
} from "@/features/catalog/services/catalogService"

const productsMock = vi.mocked(listCatalogProducts)
const agendaMock = vi.mocked(listCatalogProductAgenda)
const requirementsMock = vi.mocked(getCatalogProductResourceRequirements)

const PRODUCT: CatalogProduct = {
  id: "11111111-1111-1111-1111-111111111111",
  name: "Sessão de gravação",
  code: null, description: null, price: null, currency: "BRL",
  isActive: true, createdAt: "2026-01-01T00:00:00Z", files: [],
      visibility: "Public",
      grantedCustomerCount: 0,
      grantedGroupCount: 0,
}

const ITEM: CatalogAgendaItem = {
  orderId: "22222222-2222-2222-2222-222222222222",
  displayNumber: "PED-1042", orderStatus: "Approved",
  productId: PRODUCT.id, productName: "Sessão de gravação",
  rentalAssetId: "33333333-3333-3333-3333-333333333333", resourceName: "Sala Estúdio A",
  customerName: "Estúdio Aurora",
  workStart: "2026-11-03T12:30:00Z", workEnd: "2026-11-03T14:30:00Z",
  occupiedStart: "2026-11-03T12:00:00Z", occupiedEnd: "2026-11-03T14:50:00Z",
  allocationStatus: "Scheduled", timeZoneId: "America/Sao_Paulo",
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/catalogo/agenda-produto"]}>
      <TestPermissionProvider permissions={["catalog.orders.read"]}>
        <Routes>
          <Route path="/catalogo/agenda-produto" element={<CatalogProductAgendaPage />} />
          <Route path="/catalogo/pedidos/:orderId" element={<p>Order detail destination</p>} />
        </Routes>
      </TestPermissionProvider>
    </MemoryRouter>,
  )
}

describe("catalog product agenda page", () => {
  beforeEach(() => {
    productsMock.mockReset()
    agendaMock.mockReset()
    requirementsMock.mockReset()
    productsMock.mockResolvedValue([PRODUCT])
    agendaMock.mockResolvedValue([ITEM])
    requirementsMock.mockResolvedValue({
      expectedVersion: 1,
      requirements: [{
        id: null, rentalAssetId: ITEM.rentalAssetId, assetCategoryId: null,
        resourceQuantity: 1, durationMinutesPerUnit: 120, prepMinutes: 30, cleanupMinutes: 20,
      }],
    })
  })

  it("renders agenda items and the upcoming order link", async () => {
    renderPage()
    expect(await screen.findAllByText("PED-1042")).not.toHaveLength(0)
    const link = await screen.findByRole("link", { name: "PED-1042" })
    expect(link).toHaveAttribute("href", `/catalogo/pedidos/${ITEM.orderId}`)
    expect(screen.getByText("Estúdio Aurora")).toBeInTheDocument()
  })

  it("defaults to the week view on desktop and offers a day toggle", async () => {
    renderPage()
    await screen.findByRole("link", { name: "PED-1042" })
    expect(screen.getByRole("button", { name: i18n.t("catalog.agenda.week") })).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByRole("button", { name: i18n.t("catalog.agenda.day") })).toHaveAttribute("aria-pressed", "false")
  })

  it("exposes the staff route behind catalog.orders.read", () => {
    const route = catalogManifest.routes.staff.find((entry) => entry.path === "/catalogo/agenda-produto")
    expect(route).toBeDefined()
    expect(route?.permission).toBe("catalog.orders.read")
  })
})
