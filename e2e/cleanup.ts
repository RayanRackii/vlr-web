import type { ApiClient } from "./api-client"
import type { TenantSnapshot } from "./context"
import {
  applyCommercialModules,
  getAdminTenant,
  restoreTenant,
  sameStringSet,
  tenantCommercialModules,
} from "./tenant"

const E2E_PREFIX = "E2E"

type Named = {
  id: string
  name?: string
  label?: string
  tag?: string
  notes?: string
  status?: string
  isActive?: boolean
  scheduledDeletionAt?: string | null
  assetId?: string
  customerNote?: string
  asset?: { name?: string; tag?: string }
  items?: Array<{ productName?: string }>
}

function isE2eOwned(item: Named): boolean {
  const haystack = `${item.name ?? ""} ${item.label ?? ""} ${item.tag ?? ""} ${item.notes ?? ""} ${item.customerNote ?? ""} ${item.asset?.name ?? ""} ${item.asset?.tag ?? ""} ${item.items?.map((entry) => entry.productName ?? "").join(" ") ?? ""}`
  return haystack.toUpperCase().includes(E2E_PREFIX)
}

async function deleteAssetTwice(b2b: ApiClient, assetId: string): Promise<void> {
  await b2b.delete(`/api/assets/${assetId}`)
  await b2b.delete(`/api/assets/${assetId}`)
}

export async function deleteE2eOwnedResources(
  admin: ApiClient,
  b2b: ApiClient,
  snapshot: TenantSnapshot,
): Promise<void> {
  await applyCommercialModules(
    admin,
    snapshot,
    ["inventory", "pmoc", "os", "rentals", "catalog"],
    snapshot.familyKeys.length > 0
      ? snapshot.familyKeys
      : ["spaces", "electrical", "generic"],
  )

  const workOrders = await b2b.get<Named[]>("/api/work-orders")
  if (workOrders.status === 200 && Array.isArray(workOrders.body)) {
    for (const order of workOrders.body.filter(isE2eOwned)) {
      if (order.status !== "Canceled") {
        await b2b.request("PATCH", `/api/work-orders/${order.id}/status`, {
          status: "Canceled",
        })
      }
    }
  }

  const assets = await b2b.get<Named[]>("/api/assets")
  if (assets.status === 200 && Array.isArray(assets.body)) {
    for (const asset of assets.body.filter(isE2eOwned)) {
      await deleteAssetTwice(b2b, asset.id)
    }
  }

  const rentables = await b2b.get<Named[]>("/api/rental-assets")
  if (rentables.status === 200 && Array.isArray(rentables.body)) {
    for (const rentable of rentables.body.filter(isE2eOwned)) {
      await deleteAssetTwice(b2b, rentable.assetId ?? rentable.id)
    }
  }

  const orders = await b2b.get<Named[]>("/api/catalog/orders")
  if (orders.status === 200 && Array.isArray(orders.body)) {
    for (const order of orders.body.filter(isE2eOwned)) {
      if (order.status !== "Canceled" && order.status !== "Cancelled") {
        await b2b.post(`/api/catalog/orders/${order.id}/cancel`, {
          reason: "E2E cleanup",
        })
      }
    }
  }

  const plans = await b2b.get<Named[]>("/api/maintenance-plans")
  if (plans.status === 200 && Array.isArray(plans.body)) {
    for (const plan of plans.body.filter(isE2eOwned)) {
      await b2b.delete(`/api/maintenance-plans/${plan.id}`)
    }
  }

  const products = await b2b.get<Named[]>("/api/catalog/products")
  if (products.status === 200 && Array.isArray(products.body)) {
    for (const product of products.body.filter(isE2eOwned)) {
      await b2b.post(`/api/catalog/products/${product.id}/deactivate`)
    }
  }

  const fields = await admin.get<Named[]>(
    `/api/admin/tenants/${snapshot.id}/registration-fields`,
  )
  if (fields.status === 200 && Array.isArray(fields.body)) {
    for (const field of fields.body.filter(isE2eOwned)) {
      await admin.delete(
        `/api/admin/tenants/${snapshot.id}/registration-fields/${field.id}`,
      )
    }
  }

  const menu = await admin.get<Named[]>(
    `/api/admin/tenants/${snapshot.id}/module-menu-items`,
  )
  if (menu.status === 200 && Array.isArray(menu.body)) {
    for (const item of menu.body.filter(isE2eOwned)) {
      await admin.delete(
        `/api/admin/tenants/${snapshot.id}/module-menu-items/${item.id}`,
      )
    }
  }
}

async function leftoverE2eNames(
  b2b: ApiClient,
): Promise<string[]> {
  const leftovers: string[] = []

  const assets = await b2b.get<Named[]>("/api/assets")
  if (assets.status === 200 && Array.isArray(assets.body)) {
    for (const asset of assets.body.filter(isE2eOwned)) {
      if (!asset.scheduledDeletionAt) {
        leftovers.push(`asset:${asset.name ?? asset.id}`)
      }
    }
  }

  const workOrders = await b2b.get<Named[]>("/api/work-orders")
  if (workOrders.status === 200 && Array.isArray(workOrders.body)) {
    for (const order of workOrders.body.filter(isE2eOwned)) {
      if (order.status !== "Canceled") {
        leftovers.push(`work-order:${order.id}`)
      }
    }
  }

  const plans = await b2b.get<Named[]>("/api/maintenance-plans")
  if (plans.status === 200 && Array.isArray(plans.body)) {
    leftovers.push(
      ...plans.body.filter(isE2eOwned).map((plan) => `plan:${plan.name ?? plan.id}`),
    )
  }

  const products = await b2b.get<Named[]>("/api/catalog/products")
  if (products.status === 200 && Array.isArray(products.body)) {
    leftovers.push(
      ...products.body
        .filter((product) => isE2eOwned(product) && product.isActive !== false)
        .map((product) => `product:${product.name ?? product.id}`),
    )
  }

  const orders = await b2b.get<Named[]>("/api/catalog/orders")
  if (orders.status === 200 && Array.isArray(orders.body)) {
    for (const order of orders.body.filter(isE2eOwned)) {
      if (order.status !== "Canceled" && order.status !== "Cancelled") {
        leftovers.push(`catalog-order:${order.id}`)
      }
    }
  }

  return leftovers
}

export async function restoreSnapshotExact(
  admin: ApiClient,
  b2b: ApiClient,
  snapshot: TenantSnapshot,
): Promise<{ match: boolean; detail: string }> {
  await applyCommercialModules(
    admin,
    snapshot,
    ["inventory", "pmoc", "os", "rentals", "catalog"],
    snapshot.familyKeys.length > 0
      ? snapshot.familyKeys
      : ["spaces", "electrical", "generic"],
  )
  const leftovers = await leftoverE2eNames(b2b)

  await restoreTenant(admin, snapshot)

  const menu = await admin.get<Named[]>(
    `/api/admin/tenants/${snapshot.id}/module-menu-items`,
  )
  if (menu.status === 200 && Array.isArray(snapshot.menuItems)) {
    const current = menu.body ?? []
    const originalIds = new Set(
      (snapshot.menuItems as Named[]).map((item) => item.id),
    )
    for (const item of current) {
      if (!originalIds.has(item.id) && isE2eOwned(item)) {
        await admin.delete(
          `/api/admin/tenants/${snapshot.id}/module-menu-items/${item.id}`,
        )
      }
    }
  }

  const fields = await admin.get<Named[]>(
    `/api/admin/tenants/${snapshot.id}/registration-fields`,
  )
  if (fields.status === 200 && Array.isArray(snapshot.registrationFields)) {
    const current = fields.body ?? []
    const originalIds = new Set(
      (snapshot.registrationFields as Named[]).map((item) => item.id),
    )
    for (const item of current) {
      if (!originalIds.has(item.id) && isE2eOwned(item)) {
        await admin.delete(
          `/api/admin/tenants/${snapshot.id}/registration-fields/${item.id}`,
        )
      }
    }
  }

  const reloaded = await getAdminTenant(admin, snapshot.id)
  const modulesMatch = sameStringSet(
    tenantCommercialModules(reloaded),
    snapshot.commercialModules,
  )
  const familiesMatch = sameStringSet(
    reloaded.assetFamilyKeys,
    snapshot.familyKeys,
  )
  const maintenanceMatch =
    reloaded.activeModules.some(
      (module) =>
        module.isActive &&
        module.moduleName.trim().toLowerCase() === "maintenance",
    ) === snapshot.hasLegacyMaintenance

  if (!modulesMatch || !familiesMatch || !maintenanceMatch) {
    return {
      match: false,
      detail: `modules actual=${tenantCommercialModules(reloaded).join(",")} expected=${snapshot.commercialModules.join(",")} families actual=${reloaded.assetFamilyKeys.join(",")} expected=${snapshot.familyKeys.join(",")} maintenanceMatch=${maintenanceMatch}`,
    }
  }

  if (leftovers.length > 0) {
    return {
      match: false,
      detail: `E2E leftovers remain: ${leftovers.join(",")}`,
    }
  }

  return { match: true, detail: "RESTORE_MATCH: YES" }
}
