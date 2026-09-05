import type { ApiClient } from "./api-client"
import type { CommercialModule } from "./context"
import { COMMERCIAL_MODULES } from "./context"

export const GATE_PATHS: Record<CommercialModule, readonly string[]> = {
  inventory: ["/api/assets"],
  rentals: ["/api/rental-assets"],
  pmoc: ["/api/maintenance-plans"],
  os: ["/api/work-orders"],
  catalog: ["/api/catalog/products", "/api/catalog/orders"],
}

export function expectedGateStatus(
  module: CommercialModule,
  active: readonly string[],
): 200 | 403 {
  return active.includes(module) ? 200 : 403
}

export async function assertRuntimeGates(
  b2b: ApiClient,
  active: readonly string[],
): Promise<void> {
  const checks = COMMERCIAL_MODULES.flatMap((module) =>
    GATE_PATHS[module].map((path) => ({
      path,
      expected: expectedGateStatus(module, active),
    })),
  )

  const results = await Promise.all(
    checks.map(async (check) => {
      const result = await b2b.get(check.path)
      return { ...check, status: result.status }
    }),
  )

  const failures = results
    .filter((result) => result.status !== result.expected)
    .map(
      (result) =>
        `${result.path} for [${active.join(",") || "none"}]: expected ${result.expected}, got ${result.status}`,
    )

  if (failures.length > 0) {
    throw new Error(failures.join("\n"))
  }
}
