import {
  audienceBlocksSale,
  catalogMenuIsActive,
  type SellableGroup,
} from "@/features/catalog/components/productWizard/sellableChecklist"

export type PortalReadinessCheck = {
  key: "portalMenu" | "emptyGroup"
  href: string
}

type MenuItem = {
  moduleName: string
  isActive: boolean
}

type ProductRow = {
  id: string
  visibility?: string | null
}

type AccessRow = {
  customerIds: readonly string[]
  groupIds: readonly string[]
}

function rentalsMenuIsActive(items: readonly MenuItem[]): boolean {
  return items.some(
    (item) => item.isActive && item.moduleName.trim().toLowerCase() === "rentals",
  )
}

/** Pending customer-portal checks assembled from the menu, groups, and product access. */
export function pendingPortalChecks(input: {
  activeModules: readonly string[]
  menuItems: readonly MenuItem[] | null
  products: readonly ProductRow[]
  groups: readonly SellableGroup[]
  accessByProductId: Readonly<Record<string, AccessRow | null | undefined>>
}): PortalReadinessCheck[] {
  const checks: PortalReadinessCheck[] = []
  const modules = new Set(input.activeModules.map((moduleName) => moduleName.trim().toLowerCase()))
  const wantsCatalog = modules.has("catalog")
  const wantsRentals = modules.has("rentals")

  if ((wantsCatalog || wantsRentals) && input.menuItems) {
    const catalogReady = !wantsCatalog || catalogMenuIsActive(input.menuItems)
    const rentalsReady = !wantsRentals || rentalsMenuIsActive(input.menuItems)
    if (!catalogReady || !rentalsReady) {
      checks.push({ key: "portalMenu", href: "/configuracoes/menu" })
    }
  }

  const blocked = input.products.find((product) => {
    if (product.visibility !== "Restricted") {
      return false
    }
    const access = input.accessByProductId[product.id]
    if (!access) {
      return false
    }
    return audienceBlocksSale(
      {
        visibility: "Restricted",
        customerIds: access.customerIds,
        groupIds: access.groupIds,
      },
      input.groups,
    )
  })

  if (blocked) {
    const access = input.accessByProductId[blocked.id]
    const emptyGroupId = access?.groupIds.find((groupId) => {
      const group = input.groups.find((item) => item.id === groupId)
      return group != null && group.memberCustomerIds.length === 0
    })
    checks.push({
      key: "emptyGroup",
      href: emptyGroupId
        ? `/catalogo/grupos/${emptyGroupId}`
        : `/catalogo/produtos/${blocked.id}/assistente?passo=access`,
    })
  }

  return checks
}
