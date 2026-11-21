import { z } from "zod"

import {
  parsePublicPlans,
  planLimitsSchema,
  type PublicPlan,
} from "@/features/billing/schemas/billingSchemas"

/**
 * Tolerant readers for the tenant self-service billing contract
 * (`GET /api/billing/subscription`, `GET /api/billing/plans`, `POST .../checkout`).
 */

const nullableString = z.string().nullable().optional().transform((value) => value ?? null)
const nullableNumber = z.number().nullable().optional().transform((value) => value ?? null)
const count = z.number().nullable().optional().transform((value) => value ?? 0)

export const billingEventSchema = z.object({
  id: z.string(),
  type: nullableString,
  createdAt: z.string(),
  valueCents: nullableNumber,
  dueDate: nullableString,
})

export type BillingEvent = z.infer<typeof billingEventSchema>

const EMPTY_USAGE = { assets: 0, rentableResources: 0, users: 0, units: 0 }

const usageSchema = z
  .object({
    assets: count,
    rentableResources: count,
    users: count,
    units: count,
  })
  .nullable()
  .optional()
  .transform((value) => value ?? EMPTY_USAGE)
  .catch(EMPTY_USAGE)

export const tenantBillingSubscriptionSchema = z.object({
  hasSubscription: z.boolean().catch(false),
  subscriptionId: nullableString,
  planCatalogId: nullableString,
  packageKey: nullableString,
  planKey: nullableString,
  planName: nullableString,
  billingCycle: nullableString,
  status: nullableString,
  billingMode: nullableString,
  limitsUnlimited: z.boolean().catch(false),
  currentPeriodStart: nullableString,
  currentPeriodEnd: nullableString,
  nextChargeAt: nullableString,
  trialEndsAt: nullableString,
  discountPercent: z.number().catch(0),
  discountUntil: nullableString,
  effectiveDiscountPercent: z.number().catch(0),
  chargeCents: nullableNumber,
  monthlyEquivalentCents: nullableNumber,
  currency: z.string().nullable().optional().transform((value) => value ?? "BRL"),
  pastDueSince: nullableString,
  cancelAtPeriodEnd: z.boolean().catch(false),
  pendingPlanCatalogId: nullableString,
  pendingBillingCycle: nullableString,
  planLimits: planLimitsSchema.optional().transform((value) => value ?? {}),
  usage: usageSchema,
  events: z
    .array(z.unknown())
    .nullable()
    .optional()
    .transform((rows) =>
      (rows ?? []).flatMap((row) => {
        const parsed = billingEventSchema.safeParse(row)
        return parsed.success ? [parsed.data] : []
      }),
    ),
})

export type TenantBillingSubscription = z.infer<typeof tenantBillingSubscriptionSchema>

export type BillingPlansResult = {
  currentPlanCatalogId: string | null
  currentPackageKey: string | null
  currentBillingCycle: string | null
  plans: PublicPlan[]
}

export function parseBillingPlans(payload: unknown): BillingPlansResult {
  const record =
    typeof payload === "object" && payload !== null ? (payload as Record<string, unknown>) : {}
  const text = (value: unknown) => (typeof value === "string" ? value : null)
  return {
    currentPlanCatalogId: text(record.currentPlanCatalogId),
    currentPackageKey: text(record.currentPackageKey),
    currentBillingCycle: text(record.currentBillingCycle),
    plans: parsePublicPlans(record.plans),
  }
}

export const checkoutResultSchema = z.object({
  invoiceUrl: nullableString,
  pixQrCode: nullableString,
  pixCopyPaste: nullableString,
})

export type CheckoutResult = z.infer<typeof checkoutResultSchema>

export const CHECKOUT_METHODS = ["pix", "credit_card", "boleto"] as const
export type CheckoutMethod = (typeof CHECKOUT_METHODS)[number]
