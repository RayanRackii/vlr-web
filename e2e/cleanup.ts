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

type Named = { id: string; name?: string; label?: string; tag?: string }

function isE2eOwned(item: Named): boolean {
  const haystack = `${item.name ?? ""} ${item.label ?? ""} ${item.tag ?? ""}`
  return haystack.toUpperCase().includes(E2E_PREFIX)
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

  const assets = await b2b.get<Named[]>("/api/assets")
  if (assets.status === 200 && Array.isArray(assets.body)) {
    for (const asset of assets.body.filter(isE2eOwned)) {
      await b2b.delete(`/api/assets/${asset.id}`)
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

export async function restoreSnapshotExact(
  admin: ApiClient,
  snapshot: TenantSnapshot,
): Promise<{ match: boolean; detail: string }> {
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

  if (!modulesMatch || !familiesMatch) {
    return {
      match: false,
      detail: `modules actual=${tenantCommercialModules(reloaded).join(",")} expected=${snapshot.commercialModules.join(",")} families actual=${reloaded.assetFamilyKeys.join(",")} expected=${snapshot.familyKeys.join(",")}`,
    }
  }

  return { match: true, detail: "RESTORE_MATCH: YES" }
}
