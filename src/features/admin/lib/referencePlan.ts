import type { PublicPlan } from "@/features/billing/schemas/billingSchemas"
import { toCanonicalModuleName } from "@/features/catalog/customerNav"

/**
 * Cheapest catalog plan whose module set covers the selected modules. Pure data matching:
 * no package or tenant is named here. Returns null when nothing is selected or nothing covers it.
 */
export function suggestReferencePlan(
  plans: readonly PublicPlan[],
  selectedModules: readonly string[],
): PublicPlan | null {
  const wanted = new Set(selectedModules.map(toCanonicalModuleName))
  if (wanted.size === 0) {
    return null
  }

  return plans
    .filter((plan) => {
      const included = new Set(plan.modules.map(toCanonicalModuleName))
      return [...wanted].every((module) => included.has(module))
    })
    .reduce<PublicPlan | null>(
      (best, plan) =>
        best === null || plan.monthlyPriceCents < best.monthlyPriceCents ? plan : best,
      null,
    )
}
