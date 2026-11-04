import { createRef } from "react"
import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  CatalogProductAccessSection,
  type CatalogProductAccessSectionHandle,
} from "@/features/catalog/components/CatalogProductAccessSection"
import i18n from "@/lib/i18n"

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@/features/catalog/services/catalogService", () => ({
  getCatalogProductAccess: vi.fn(),
  getCatalogProductAccessHistory: vi.fn(),
  listCustomerGroups: vi.fn(),
  putCatalogProductAccess: vi.fn(),
}))
vi.mock("@/features/users/services/usersService", () => ({ listTenantCustomers: vi.fn() }))

import {
  getCatalogProductAccess,
  getCatalogProductAccessHistory,
  listCustomerGroups,
  putCatalogProductAccess,
} from "@/features/catalog/services/catalogService"
import { listTenantCustomers } from "@/features/users/services/usersService"

const PID = "p1"

function setup(canManage: boolean, visibility: "Public" | "Restricted" = "Public") {
  vi.mocked(getCatalogProductAccess).mockResolvedValue({
    productId: PID, visibility, customerIds: [], groupIds: [], restrictedWithoutGrants: visibility === "Restricted",
  } as never)
  const ref = createRef<CatalogProductAccessSectionHandle>()
  render(<CatalogProductAccessSection ref={ref} productId={PID} canManage={canManage} />)
  return ref
}

const restrictedLabel = () => i18n.t("catalog.products.access.restricted")

describe("CatalogProductAccessSection", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getCatalogProductAccessHistory).mockResolvedValue([] as never)
    vi.mocked(listCustomerGroups).mockResolvedValue([
      { id: "g1", name: "Revenda", description: null, memberCustomerIds: [], createdAt: "2026-11-03T10:00:00Z", updatedAt: null },
    ] as never)
    vi.mocked(listTenantCustomers).mockResolvedValue({ items: [], totalCount: 0, page: 1, pageSize: 50 } as never)
    vi.mocked(putCatalogProductAccess).mockResolvedValue({ productId: PID, visibility: "Restricted", customerIds: [], groupIds: ["g1"], restrictedWithoutGrants: false } as never)
  })

  it("saves a restricted grant with the selected group", async () => {
    const user = userEvent.setup()
    const ref = setup(true)
    await user.click(await screen.findByRole("radio", { name: new RegExp(restrictedLabel()) }))
    await user.click(await screen.findByRole("checkbox", { name: "Revenda" }))
    await act(() => ref.current!.persist())
    expect(putCatalogProductAccess).toHaveBeenCalledWith(
      PID,
      expect.objectContaining({ visibility: "Restricted", groupIds: ["g1"], customerIds: [] }),
    )
  })

  it("warns when restricted with nobody granted", async () => {
    setup(true, "Restricted")
    expect(await screen.findByRole("alert")).toHaveTextContent(i18n.t("catalog.products.access.emptyWarning"))
  })

  it("is read-only without manage permission and never saves", async () => {
    const ref = setup(false)
    const radio = await screen.findByRole("radio", { name: new RegExp(restrictedLabel()) })
    expect(radio).toBeDisabled()
    await act(() => ref.current!.persist())
    await waitFor(() => expect(putCatalogProductAccess).not.toHaveBeenCalled())
  })
})
