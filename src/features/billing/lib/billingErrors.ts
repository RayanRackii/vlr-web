import { getAxiosErrorPayload, isAxiosError } from "@/lib/api"
import { readApiErrorBody } from "@/lib/apiErrorText"
import i18n from "@/lib/i18n"

const CODE_KEYS: Record<string, string> = {
  "billing.invalid_cycle": "billing.errors.invalidCycle",
  "billing.invalid_method": "billing.errors.invalidMethod",
  "billing.plan_not_found": "billing.errors.planNotFound",
  "billing.contact_email_required": "billing.errors.contactEmailRequired",
  "billing.tax_id_invalid": "billing.errors.taxIdInvalid",
  "billing.currency_mismatch": "billing.errors.currencyMismatch",
  "billing.no_subscription": "billing.errors.noSubscription",
  "billing.no_active_subscription": "billing.errors.noActiveSubscription",
  "billing.already_subscribed": "billing.errors.alreadySubscribed",
  "billing.no_open_invoice": "billing.errors.noOpenInvoice",
  "billing.nothing_to_charge": "billing.errors.nothingToCharge",
  "billing.concurrent_change": "billing.errors.concurrentChange",
  "plan.usage_above_limit": "billing.errors.usageAboveLimit",
  "billing.provider_error": "billing.errors.providerError",
  "billing.not_configured": "billing.errors.notConfigured",
  "idempotency.key_reused": "apiErrors.idempotencyKey",
  "idempotency.key_invalid": "apiErrors.idempotencyKey",
  "idempotency.in_progress": "billing.errors.inProgress",
}

/** Friendly localized text for a billing API error; the generic text when the code is unknown. */
export function billingErrorMessage(error: unknown): string {
  const payload = isAxiosError(error) ? getAxiosErrorPayload(error) : null
  const body = readApiErrorBody(payload)
  const key = body.code ? CODE_KEYS[body.code] : undefined
  if (key === undefined) {
    return i18n.t("billing.errors.generic")
  }
  if (body.code === "plan.usage_above_limit" && typeof payload === "object" && payload !== null) {
    const record = payload as Record<string, unknown>
    return i18n.t(key, {
      limit:
        typeof record.limit === "string"
          ? i18n.t(`billing.limitNames.${record.limit}`, { defaultValue: record.limit })
          : "",
      current: typeof record.current === "number" ? record.current : "",
      max: typeof record.max === "number" ? record.max : "",
    })
  }
  return i18n.t(key)
}
