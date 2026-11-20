import { listPlanningAssets } from "@/features/planning/services/planningService"
import { listAdminRentalAssets } from "@/features/rentals/services/scheduleService"
import type { NamedAsset } from "@/features/catalog/lib/orderResourceFact"

function moduleActive(modules: readonly string[], name: string): boolean {
  return modules.some((module) => module.trim().toLowerCase() === name)
}

/**
 * Names for the resources a catalog product or order points at. Planning assets are keyed by
 * asset id, rental assets by rental asset id; only the services of active modules are called
 * so a tenant without rentals never triggers a 403.
 */
export async function listCatalogResourceNames(activeModules: readonly string[]): Promise<NamedAsset[]> {
  const [planning, rentals] = await Promise.all([
    moduleActive(activeModules, "resource-planning")
      ? listPlanningAssets("all").catch(() => [])
      : Promise.resolve([]),
    moduleActive(activeModules, "rentals")
      ? listAdminRentalAssets().catch(() => [])
      : Promise.resolve([]),
  ])
  return [
    ...planning.map((asset) => ({ id: asset.id, name: asset.name, unitId: asset.unitId })),
    ...rentals.map((asset) => ({ id: asset.id, name: asset.name, unitId: asset.unitId })),
  ]
}

