import { isCatalogModuleName } from "@/features/catalog/customerNav"
import { menuDeepLink } from "@/features/rentals/components/resourceWizard/wizardSteps"

import {
  productGroupDeepLink,
  productWizardPath,
  type ProductWizardStepId,
} from "@/features/catalog/components/productWizard/wizardSteps"

export type SellableChecklistItemId = "listed" | "portalMenu" | "audience" | "resource"

export type SellableChecklistStatus = "done" | "missing" | "unavailable" | "notApplicable"

export type SellableChecklistAction =
  | { kind: "none" }
  | { kind: "step"; step: ProductWizardStepId }
  | { kind: "link"; href: string }
  | { kind: "createMenu" }

export type SellableChecklistItem = {
  id: SellableChecklistItemId
  status: SellableChecklistStatus
  /** True when this gap stops a customer from buying. */
  blocksSale: boolean
  action: SellableChecklistAction
}

export type SellableSummary = "ready" | "missing" | "unknown" | "inactive"

export type SellableProduct = {
  id: string
  isActive: boolean
  visibility: "Public" | "Restricted"
}

export type SellableAccess = {
  visibility: "Public" | "Restricted"
  customerIds: readonly string[]
  groupIds: readonly string[]
}

export type SellableGroup = {
  id: string
  memberCustomerIds: readonly string[]
}

export type SellableMenuItem = {
  moduleName: string
  isActive: boolean
}

export type SellableRequirement = {
  rentalAssetId?: string | null
}

/** `inactive` means the API refused resource linking (module not active). */
export type ResourceCapability = "ready" | "inactive" | "unknown"

export type SellableChecklistPermissions = {
  menuRead: boolean
  menuWrite: boolean
}

export type SellableChecklistInput = {
  product: SellableProduct
  access: SellableAccess | null
  groups: readonly SellableGroup[] | null
  menuItems: readonly SellableMenuItem[] | null
  requirements: readonly SellableRequirement[] | null
  resourceCapability: ResourceCapability
  rentalsActive: boolean
  permissions: SellableChecklistPermissions
}

export function catalogMenuIsActive(items: readonly SellableMenuItem[]): boolean {
  return items.some((item) => item.isActive && isCatalogModuleName(item.moduleName))
}

function listedItem(input: SellableChecklistInput): SellableChecklistItem {
  return {
    id: "listed",
    status: input.product.isActive ? "done" : "missing",
    blocksSale: true,
    action: { kind: "step", step: "offer" },
  }
}

function portalItem(input: SellableChecklistInput): SellableChecklistItem {
  const href = menuDeepLink(productWizardPath(input.product.id))
  if (!input.permissions.menuRead || input.menuItems === null) {
    return { id: "portalMenu", status: "unavailable", blocksSale: true, action: { kind: "none" } }
  }
  if (catalogMenuIsActive(input.menuItems)) {
    return { id: "portalMenu", status: "done", blocksSale: true, action: { kind: "link", href } }
  }
  if (input.permissions.menuWrite) {
    return { id: "portalMenu", status: "missing", blocksSale: true, action: { kind: "createMenu" } }
  }
  return { id: "portalMenu", status: "missing", blocksSale: true, action: { kind: "link", href } }
}

/** Restricted, and every granted group is empty, and no customer is named. */
export function audienceBlocksSale(
  access: SellableAccess,
  groups: readonly SellableGroup[],
): boolean {
  if (access.visibility !== "Restricted") {
    return false
  }
  if (access.customerIds.length > 0) {
    return false
  }
  if (access.groupIds.length === 0) {
    return true
  }
  return access.groupIds.every((groupId) => {
    const group = groups.find((item) => item.id === groupId)
    return (group?.memberCustomerIds.length ?? 0) === 0
  })
}

export function firstEmptyGrantedGroupId(
  access: SellableAccess,
  groups: readonly SellableGroup[],
): string | null {
  if (access.visibility !== "Restricted") {
    return null
  }
  return access.groupIds.find((groupId) => {
    const group = groups.find((item) => item.id === groupId)
    return group != null && group.memberCustomerIds.length === 0
  }) ?? null
}

function audienceItem(input: SellableChecklistInput): SellableChecklistItem {
  const step = { kind: "step", step: "access" } as const
  if (input.access === null) {
    return { id: "audience", status: "unavailable", blocksSale: true, action: { kind: "none" } }
  }
  if (input.access.visibility !== "Restricted") {
    return { id: "audience", status: "done", blocksSale: false, action: step }
  }
  if (input.access.groupIds.length > 0 && input.groups === null) {
    return { id: "audience", status: "unavailable", blocksSale: true, action: { kind: "none" } }
  }
  const groups = input.groups ?? []
  if (audienceBlocksSale(input.access, groups)) {
    const emptyGroupId = firstEmptyGrantedGroupId(input.access, groups)
    const action: SellableChecklistAction = emptyGroupId
      ? { kind: "link", href: productGroupDeepLink(emptyGroupId, productWizardPath(input.product.id, "access")) }
      : step
    return { id: "audience", status: "missing", blocksSale: true, action }
  }
  return { id: "audience", status: "done", blocksSale: true, action: step }
}

function resourceItem(input: SellableChecklistInput): SellableChecklistItem {
  const step = { kind: "step", step: "resource" } as const
  if (!input.rentalsActive) {
    return { id: "resource", status: "notApplicable", blocksSale: false, action: { kind: "none" } }
  }
  if (input.resourceCapability === "inactive") {
    return { id: "resource", status: "unavailable", blocksSale: false, action: step }
  }
  if (input.resourceCapability !== "ready" || input.requirements === null) {
    return { id: "resource", status: "unavailable", blocksSale: true, action: { kind: "none" } }
  }
  const incomplete = input.requirements.some((row) => (row.rentalAssetId?.trim().length ?? 0) === 0)
  const usesResource = input.requirements.length > 0
  return {
    id: "resource",
    status: incomplete ? "missing" : "done",
    blocksSale: usesResource,
    action: step,
  }
}

export function buildSellableChecklist(input: SellableChecklistInput): SellableChecklistItem[] {
  return [listedItem(input), portalItem(input), audienceItem(input), resourceItem(input)]
}

export function sellableSummary(
  productIsActive: boolean,
  items: readonly SellableChecklistItem[],
): SellableSummary {
  if (!productIsActive) {
    return "inactive"
  }
  if (items.some((item) => item.blocksSale && item.status === "missing")) {
    return "missing"
  }
  if (items.some((item) => item.blocksSale && item.status === "unavailable")) {
    return "unknown"
  }
  return "ready"
}
