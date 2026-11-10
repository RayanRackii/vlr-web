import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { beforeEach, expect, it, vi } from "vitest"
import { ProductAssistantPage } from "./ProductAssistantPage"
import { useProductWizard } from "@/features/catalog/components/productWizard/useProductWizard"
import { listAdminRentalAssets } from "@/features/rentals/services/scheduleService"

vi.mock("@/features/catalog/components/productWizard/useProductWizard", () => ({ useProductWizard: vi.fn() }))
vi.mock("@/features/rentals/services/scheduleService", () => ({ listAdminRentalAssets: vi.fn() }))

const productId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const assetId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(listAdminRentalAssets).mockResolvedValue([{ id: assetId, name: "Estúdio A", queueEnabled: false, queueOpeningTime: null } as never])
  vi.mocked(useProductWizard).mockReturnValue({
    loading: false,
    error: null,
    busy: false,
    rentalsActive: true,
    canManage: true,
    canSearchCustomers: false,
    wizardPath: `/catalogo/produtos/${productId}/assistente`,
    reload: vi.fn(),
    publishMenu: vi.fn(),
    model: {
      product: { id: productId, name: "Diária", isActive: true, price: null, visibility: "Public" },
      access: { visibility: "Public", customerIds: [], groupIds: [] },
      groups: [],
      menuItems: [],
      requirements: [{ rentalAssetId: assetId }],
      resourceCapability: "ready",
    },
  } as never)
})

function setup() {
  return render(
    <MemoryRouter initialEntries={[`/catalogo/produtos/${productId}/passos`]}>
      <Routes><Route path="/catalogo/produtos/:id/passos" element={<ProductAssistantPage />} /></Routes>
    </MemoryRouter>,
  )
}

it("links the used resource and does not invent a deposit or a lead time", async () => {
  const user = userEvent.setup()
  setup()
  expect(screen.getByRole("heading", { name: "Diária" })).toBeInTheDocument()
  for (const name of ["Dados", "Agenda", "Fila", "Regras", "Preços", "Publicação"]) {
    expect(screen.getByRole("heading", { name: new RegExp(name) })).toBeInTheDocument()
  }
  expect(screen.queryByText(/antecedência|sinal|30%/i)).not.toBeInTheDocument()
  await user.click(within(screen.getByRole("region", { name: "Publicação" })).getByRole("button", { name: "Editar" }))
  const link = await screen.findByRole("link", { name: "Abrir recurso" })
  expect(link).toHaveAttribute("href", `/configuracoes/recursos/${assetId}/passos`)
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Continuar em Preços" })).toHaveClass("w-full")
})
