import { z } from "zod"

/**
 * Tolerant readers for the billing contract (plan catalog, tenant subscription, MRR summary).
 * Unknown fields are ignored and optional ones fall back, so an older or newer API never breaks a page.
 */

export const PACKAGE_KEYS = ["reservas", "manutencao", "locacao"] as const
export type PackageKey = (typeof PACKAGE_KEYS)[number]

export const PLAN_KEYS = ["essencial", "profissional", "completo"] as const
export type PlanKey = (typeof PLAN_KEYS)[number]

export function isPackageKey(value: unknown): value is PackageKey {
  return typeof value === "string" && (PACKAGE_KEYS as readonly string[]).includes(value)
}

export function isPlanKey(value: unknown): value is PlanKey {
  return typeof value === "string" && (PLAN_KEYS as readonly string[]).includes(value)
}

const nullableCount = z.number().nullable().optional().catch(null)

export const planLimitsSchema = z
  .object({
    assets: nullableCount,
    rentableResources: nullableCount,
    users: nullableCount,
    units: nullableCount,
    whatsappMessagesMonth: nullableCount,
  })
  .catch({})

export type PlanLimits = z.infer<typeof planLimitsSchema>

export const publicPlanSchema = z.object({
  id: z.string(),
  packageKey: z.string(),
  planKey: z.string(),
  name: z.string().catch(""),
  monthlyPriceCents: z.number().catch(0),
  annualPriceCents: z.number().catch(0),
  currency: z.string().nullable().optional().transform((value) => value ?? "BRL"),
  modules: z.array(z.string()).nullable().optional().transform((value) => value ?? []),
  limits: planLimitsSchema.optional().transform((value) => value ?? {}),
  sortOrder: z.number().catch(0),
})

export type PublicPlan = z.infer<typeof publicPlanSchema>

/** One unreadable row is dropped instead of failing the whole list. */
export function parsePublicPlans(payload: unknown): PublicPlan[] {
  if (!Array.isArray(payload)) {
    return []
  }
  return payload
    .flatMap((row) => {
      const parsed = publicPlanSchema.safeParse(row)
      return parsed.success ? [parsed.data] : []
    })
    .sort((a, b) => a.sortOrder - b.sortOrder)
}

const nullableString = z.string().nullable().optional().transform((value) => value ?? null)

export const subscriptionEventSchema = z.object({
  id: z.string(),
  type: nullableString,
  createdAt: z.string(),
})

export const tenantSubscriptionSchema = z.object({
  tenantId: z.string().optional().transform((value) => value ?? ""),
  hasSubscription: z.boolean().catch(false),
  subscriptionId: nullableString,
  planCatalogId: nullableString,
  packageKey: nullableString,
  planKey: nullableString,
  planName: nullableString,
  status: nullableString,
  billingCycle: nullableString,
  billingMode: nullableString,
  provider: nullableString,
  currency: nullableString,
  limitsUnlimited: z.boolean().catch(false),
  discountPercent: z.number().catch(0),
  effectiveDiscountPercent: z.number().catch(0),
  discountUntil: nullableString,
  monthlyEquivalentCents: z.number().catch(0),
  currentPeriodStart: nullableString,
  currentPeriodEnd: nullableString,
  pastDueSince: nullableString,
  canceledAt: nullableString,
  planLimits: planLimitsSchema.optional().transform((value) => value ?? {}),
  events: z
    .array(z.unknown())
    .nullable()
    .optional()
    .transform((rows) =>
      (rows ?? []).flatMap((row) => {
        const parsed = subscriptionEventSchema.safeParse(row)
        return parsed.success ? [parsed.data] : []
      }),
    ),
})

export type TenantSubscription = z.infer<typeof tenantSubscriptionSchema>
export type SubscriptionEvent = z.infer<typeof subscriptionEventSchema>

export const SUBSCRIPTION_STATUSES = [
  "trialing",
  "active",
  "past_due",
  "read_only",
  "canceled",
] as const
export const BILLING_CYCLES = ["monthly", "annual"] as const
export const BILLING_MODES = ["provider", "manual"] as const

export type PutTenantSubscriptionRequest = {
  planCatalogId?: string | null
  billingCycle?: string | null
  status?: string | null
  billingMode?: string | null
  limitsUnlimited?: boolean | null
  discountPercent?: number | null
  discountUntil?: string | null
  coupon?: string | null
}

const packageSummarySchema = z.object({
  packageKey: nullableString,
  mrrCents: z.number().catch(0),
  trialingCount: z.number().catch(0),
  activeCount: z.number().catch(0),
  pastDueCount: z.number().catch(0),
  readOnlyCount: z.number().catch(0),
})

export const billingSummarySchema = z.object({
  currency: z.string().nullable().optional().transform((value) => value ?? "BRL"),
  mrrCents: z.number().catch(0),
  trialingCount: z.number().catch(0),
  activeCount: z.number().catch(0),
  pastDueCount: z.number().catch(0),
  readOnlyCount: z.number().catch(0),
  byPackage: z
    .array(packageSummarySchema)
    .nullable()
    .optional()
    .transform((rows) => rows ?? [])
    .catch([]),
})

export type BillingSummary = z.infer<typeof billingSummarySchema>
