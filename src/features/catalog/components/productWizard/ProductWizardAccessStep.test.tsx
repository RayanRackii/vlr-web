import { act, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { MemoryRouter } from "react-router-dom"

import { ProductWizardAccessStep } from "@/features/catalog/components/productWizard/ProductWizardAccessStep"
import { addCustomerGroupMembers, putCatalogProductAccess } from "@/features/catalog/services/catalogService"
import { listTenantCustomers } from "@/features/users/services/usersService"
import i18n from "@/lib/i18n"
import { createStepShell } from "@/features/assistant/testStepShell"

vi.mock("@/features/catalog/services/catalogService", () => ({
  addCustomerGroupMembers: vi.fn(),
  putCatalogProductAccess: vi.fn(),
}))

vi.mock("@/features/users/services/usersService", () => ({
  listTenantCustomers: vi.fn(),
}))

const ANA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const BIA = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
const GROUP = "group-1"

function customer(id: string, name: string, email: string) {
  return { id, name, email, emailVerified: true, createdAt: "2026-11-09T12:00:00.000Z" }
}

describe("ProductWizardAccessStep member pick", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(addCustomerGroupMembers).mockResolvedValue({} as never)
    vi.mocked(putCatalogProductAccess).mockResolvedValue({} as never)
    vi.mocked(listTenantCustomers).mockResolvedValue({
      items: [customer(ANA, "Ana", "ana@example.com"), customer(BIA, "Bia", "bia@example.com")],
      page: 1,
      pageSize: 5,
      total: 2,
    })
  })

  it("adds only the customer that was picked, never the first search hit", async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
      <ProductWizardAccessStep
        productId="product-1"
        visibility="Restricted"
        customerIds={[]}
        groupIds={[GROUP]}
        groups={[{
          id: GROUP,
          name: "Sócios",
          description: null,
          memberCustomerIds: [],
          createdAt: "2026-11-09T12:00:00.000Z",
          updatedAt: null,
        }]}
        wizardPath="/catalogo/produtos/product-1/assistente?passo=access"
        readOnly={false}
        canSearchCustomers
        onSaved={vi.fn()}
      />
      </MemoryRouter>,
    )

    const search = screen.getByRole("textbox", { name: i18n.t("catalog.productWizard.memberSearch") })
    await user.type(search, "a")
    await user.keyboard("{Enter}")
    expect(listTenantCustomers).not.toHaveBeenCalled()
    expect(addCustomerGroupMembers).not.toHaveBeenCalled()

    await user.type(search, "n")
    await user.keyboard("{Enter}")
    expect(listTenantCustomers).toHaveBeenCalled()
    expect(addCustomerGroupMembers).not.toHaveBeenCalled()
    expect(await screen.findByRole("button", { name: /Bia/ })).toBeInTheDocument()

    await user.keyboard("{Enter}")
    expect(addCustomerGroupMembers).not.toHaveBeenCalled()

    await user.click(screen.getByRole("button", { name: /Bia/ }))
    expect(addCustomerGroupMembers).toHaveBeenCalledTimes(1)
    expect(addCustomerGroupMembers).toHaveBeenCalledWith(GROUP, [BIA])
  })
})

describe("ProductWizardAccessStep inside the cadastro shell", () => {
  function renderStep(shellWrap: boolean) {
    const { StepShell, shell } = createStepShell()
    const step = (
      <MemoryRouter>
        <ProductWizardAccessStep
          productId="product-1"
          visibility="Public"
          customerIds={[]}
          groupIds={[]}
          groups={[]}
          wizardPath="/x"
          readOnly={false}
          canSearchCustomers={false}
          onSaved={vi.fn()}
        />
      </MemoryRouter>
    )
    render(shellWrap ? <StepShell>{step}</StepShell> : step)
    return shell
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(putCatalogProductAccess).mockResolvedValue({} as never)
  })

  it("keeps its Save button outside a shell", () => {
    renderStep(false)
    expect(screen.getByRole("button", { name: i18n.t("common.save") })).toBeInTheDocument()
  })

  it("hides Save and resolves true without a request when nothing changed", async () => {
    const shell = renderStep(true)
    expect(screen.queryByRole("button", { name: i18n.t("common.save") })).not.toBeInTheDocument()
    let result: boolean | null = null
    await act(async () => { result = await shell.submit() })
    expect(result).toBe(true)
    expect(putCatalogProductAccess).not.toHaveBeenCalled()
  })

  it("saves a changed visibility and resolves true", async () => {
    const user = userEvent.setup()
    const shell = renderStep(true)
    await user.click(screen.getByRole("button", { name: i18n.t("catalog.products.visibilityFilter.restricted") }))
    let result: boolean | null = null
    await act(async () => { result = await shell.submit() })
    expect(result).toBe(true)
    expect(putCatalogProductAccess).toHaveBeenCalledWith("product-1", expect.objectContaining({ visibility: "Restricted" }))
  })

  it("resolves false and shows an inline alert when the request fails", async () => {
    const user = userEvent.setup()
    vi.mocked(putCatalogProductAccess).mockRejectedValue(new Error("Falha de acesso"))
    const shell = renderStep(true)
    await user.click(screen.getByRole("button", { name: i18n.t("catalog.products.visibilityFilter.restricted") }))
    let result: boolean | null = null
    await act(async () => { result = await shell.submit() })
    expect(result).toBe(false)
    expect(await screen.findByRole("alert")).toHaveTextContent("Falha de acesso")
  })
})
