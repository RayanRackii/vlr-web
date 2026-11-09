export type ExclusiveProduct = {
  id: string
  name: string
  visibility?: string | null
}

export type ProductAccessGrant = {
  customerIds: readonly string[]
  groupIds: readonly string[]
}

export function exclusiveProductsForCustomer(input: {
  customerId: string
  groupIds: readonly string[]
  products: readonly ExclusiveProduct[]
  accessByProductId: Readonly<Record<string, ProductAccessGrant | null | undefined>>
}): ExclusiveProduct[] {
  const groups = new Set(input.groupIds)
  return input.products.filter((product) => {
    if (product.visibility !== "Restricted") {
      return false
    }
    const access = input.accessByProductId[product.id]
    if (!access) {
      return false
    }
    return access.customerIds.includes(input.customerId)
      || access.groupIds.some((groupId) => groups.has(groupId))
  })
}
