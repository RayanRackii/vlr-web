import { ApiClient, expectStatus, type AdminTenant } from "./api-client"
import {
  canonicalModules,
  commercialOnly,
  type TenantSnapshot,
} from "./context"

export const MATRIX_FAMILIES = ["spaces", "electrical", "generic"] as const

export function tenantCommercialModules(tenant: AdminTenant): string[] {
  return commercialOnly(
    canonicalModules(tenant.activeModules.filter((module) => module.isActive)),
  )
}

export function hasLegacyMaintenance(tenant: AdminTenant): boolean {
  return tenant.activeModules.some(
    (module) =>
      module.isActive &&
      module.moduleName.trim().toLowerCase() === "maintenance",
  )
}

export async function getAdminTenant(
  admin: ApiClient,
  tenantId: string,
): Promise<AdminTenant> {
  const result = await admin.get<AdminTenant>(`/api/admin/tenants/${tenantId}`)
  await expectStatus(result, 200, "GET admin tenant")
  if (!result.body) {
    throw new Error("GET admin tenant returned empty body")
  }
  return result.body
}

export async function updateAdminTenant(
  admin: ApiClient,
  snapshot: Pick<
    TenantSnapshot,
    | "legalName"
    | "taxId"
    | "subdomain"
    | "logoSvg"
    | "primaryColor"
    | "accentColor"
    | "welcomeTagline"
  >,
  tenantId: string,
  modules: readonly string[],
  familyKeys: readonly string[],
): Promise<{ status: number; tenant: AdminTenant | null; text: string }> {
  const result = await admin.put<AdminTenant>(`/api/admin/tenants/${tenantId}`, {
    legalName: snapshot.legalName,
    taxId: snapshot.taxId,
    subdomain: snapshot.subdomain,
    logoSvg: snapshot.logoSvg,
    primaryColor: snapshot.primaryColor,
    accentColor: snapshot.accentColor,
    welcomeTagline: snapshot.welcomeTagline,
    activeModules: [...modules],
    assetFamilyKeys: [...familyKeys],
  })
  return {
    status: result.status,
    tenant: result.body,
    text: result.text,
  }
}

export async function applyCommercialModules(
  admin: ApiClient,
  snapshot: TenantSnapshot,
  modules: readonly string[],
  familyKeys: readonly string[] = MATRIX_FAMILIES,
): Promise<AdminTenant> {
  const updated = await updateAdminTenant(
    admin,
    snapshot,
    snapshot.id,
    modules,
    familyKeys,
  )
  if (updated.status !== 200 || !updated.tenant) {
    throw new Error(
      `Failed to apply modules [${modules.join(",")}]: ${updated.status} ${updated.text.slice(0, 240)}`,
    )
  }
  return updated.tenant
}

export async function restoreTenant(
  admin: ApiClient,
  snapshot: TenantSnapshot,
): Promise<AdminTenant> {
  return applyCommercialModules(
    admin,
    snapshot,
    snapshot.commercialModules,
    snapshot.familyKeys,
  )
}

export function assertExactCommercial(
  tenant: AdminTenant,
  expected: readonly string[],
  options: { allowLegacyMaintenance: boolean },
): void {
  const actual = tenantCommercialModules(tenant).sort()
  const wanted = [...expected].sort()
  if (actual.join("|") !== wanted.join("|")) {
    throw new Error(
      `Module set mismatch. expected=${wanted.join(",")} actual=${actual.join(",")}`,
    )
  }

  const keys = canonicalModules(tenant.activeModules.filter((m) => m.isActive))
  if (keys.includes("asset-registry") || keys.includes("asset_registry")) {
    throw new Error("asset-registry appeared in tenant_modules")
  }

  const maintenanceOn = hasLegacyMaintenance(tenant)
  if (maintenanceOn && !options.allowLegacyMaintenance) {
    throw new Error("maintenance was newly inserted")
  }
}

export function sameStringSet(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return [...left].sort().join("|") === [...right].sort().join("|")
}
