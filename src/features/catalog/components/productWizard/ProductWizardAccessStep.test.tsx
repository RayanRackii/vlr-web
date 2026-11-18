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
    expect(await screen.findByText("Falha de acesso")).toBeInTheDocument()
  })
})

describe("ProductWizardAccessStep direct customer grants", () => {
  const CUSTOMER = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"

  function renderGrants(props: { visibility?: "Public" | "Restricted"; customerIds?: string[]; customerNames?: Record<string, string>; groupIds?: string[]; canSearchCustomers?: boolean; readOnly?: boolean } = {}) {
    const { StepShell, shell } = createStepShell()
    const onDirtyChange = vi.fn()
    render(
      <StepShell>
        <MemoryRouter>
          <ProductWizardAccessStep
            productId="product-1"
            visibility={props.visibility ?? "Restricted"}
            customerIds={props.customerIds ?? []}
            customerNames={props.customerNames}
            groupIds={props.groupIds ?? []}
            groups={[]}
            wizardPath="/x"
            readOnly={props.readOnly ?? false}
            canSearchCustomers={props.canSearchCustomers ?? true}
            onSaved={vi.fn()}
            onDirtyChange={onDirtyChange}
          />
        </MemoryRouter>
      </StepShell>,
    )
    return { shell, onDirtyChange }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(putCatalogProductAccess).mockResolvedValue({} as never)
    vi.mocked(listTenantCustomers).mockResolvedValue({
      items: [customer(ANA, "Ana", "ana@example.com")], page: 1, pageSize: 20, total: 1,
    })
  })

  it("lists the granted customers by name, each with a remove button", () => {
    renderGrants({ customerIds: [CUSTOMER], customerNames: { [CUSTOMER]: "Cliente Nove" } })
    expect(screen.getByRole("button", { name: "Cliente Nove" })).toBeInTheDocument()
    expect(screen.queryByText(i18n.t("catalog.products.access.namesUnavailable"))).not.toBeInTheDocument()
  })

  it("says so when a granted customer has no name", () => {
    renderGrants({ customerIds: [CUSTOMER] })
    expect(screen.getByText(i18n.t("catalog.products.access.namesUnavailable"))).toBeInTheDocument()
  })

  it("adds a customer from the picker and saves the edited customerIds", async () => {
    const user = userEvent.setup()
    const { shell, onDirtyChange } = renderGrants({ groupIds: ["g1"] })
    await user.type(screen.getByPlaceholderText(i18n.t("catalog.products.access.searchCustomers")), "an")
    await user.click(await screen.findByRole("button", { name: /Ana/ }))
    expect(screen.getByRole("button", { name: "Ana" })).toBeInTheDocument()
    expect(onDirtyChange).toHaveBeenLastCalledWith(true)
    let result: boolean | null = null
    await act(async () => { result = await shell.submit() })
    expect(result).toBe(true)
    expect(putCatalogProductAccess).toHaveBeenCalledWith("product-1", { visibility: "Restricted", customerIds: [ANA], groupIds: ["g1"] })
  })

  it("removes a granted customer and saves without it", async () => {
    const user = userEvent.setup()
    const { shell } = renderGrants({ customerIds: [CUSTOMER, ANA], customerNames: { [CUSTOMER]: "Cliente Nove", [ANA]: "Ana" }, groupIds: ["g1"] })
    await user.click(screen.getByRole("button", { name: "Cliente Nove" }))
    expect(screen.queryByRole("button", { name: "Cliente Nove" })).not.toBeInTheDocument()
    await act(async () => { await shell.submit() })
    expect(putCatalogProductAccess).toHaveBeenCalledWith("product-1", { visibility: "Restricted", customerIds: [ANA], groupIds: ["g1"] })
  })

  it("hides the picker without core.customers.read and never calls the directory", () => {
    renderGrants({ canSearchCustomers: false })
    expect(screen.getByText(i18n.t("catalog.products.access.needCustomersPermission"))).toBeInTheDocument()
    expect(screen.queryByPlaceholderText(i18n.t("catalog.products.access.searchCustomers"))).not.toBeInTheDocument()
    expect(listTenantCustomers).not.toHaveBeenCalled()
  })

  it("shows the picker when searching is allowed", () => {
    renderGrants()
    expect(screen.getByPlaceholderText(i18n.t("catalog.products.access.searchCustomers"))).toBeInTheDocument()
  })

  it("is read-only: no picker and the grants cannot be removed", () => {
    renderGrants({ readOnly: true, customerIds: [CUSTOMER], customerNames: { [CUSTOMER]: "Cliente Nove" } })
    expect(screen.queryByPlaceholderText(i18n.t("catalog.products.access.searchCustomers"))).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Cliente Nove" })).toBeDisabled()
  })

  it("warns when Restricted with nobody granted, and not once someone is", () => {
    renderGrants()
    expect(screen.getByRole("alert")).toHaveTextContent(i18n.t("catalog.products.access.emptyWarning"))
  })

  it("does not warn when a customer is granted", () => {
    renderGrants({ customerIds: [CUSTOMER], customerNames: { [CUSTOMER]: "Cliente Nove" } })
    expect(screen.queryByText(i18n.t("catalog.products.access.emptyWarning"))).not.toBeInTheDocument()
  })

  it("keeps stored grants on Public with a hint and sends them on save", async () => {
    const user = userEvent.setup()
    const { shell } = renderGrants({ visibility: "Restricted", customerIds: [CUSTOMER], customerNames: { [CUSTOMER]: "Cliente Nove" }, groupIds: ["g1"] })
    await user.click(screen.getByRole("button", { name: i18n.t("catalog.products.visibilityFilter.public") }))
    expect(screen.getByText(i18n.t("catalog.products.access.storedGrantsHint", { count: 2 }))).toBeInTheDocument()
    await act(async () => { await shell.submit() })
    expect(putCatalogProductAccess).toHaveBeenCalledWith("product-1", { visibility: "Public", customerIds: [CUSTOMER], groupIds: ["g1"] })
  })
})
