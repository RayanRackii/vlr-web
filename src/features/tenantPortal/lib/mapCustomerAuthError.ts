import { parseApiError } from "@/lib/api"
import i18n from "@/lib/i18n"

const CUSTOMER_AUTH_ERROR_KEYS: Record<string, string> = {
  "Invalid email or password.": "tenantPortal.login.invalidCredentials",
  "Invalid email or password": "tenantPortal.login.invalidCredentials",
  "Invalid login credentials": "tenantPortal.login.invalidCredentials",
  "Email is not verified. Complete email verification first.":
    "tenantPortal.login.emailNotVerified",
  "Invalid or expired verification code.":
    "tenantPortal.verify.invalidOrExpired",
  "A customer with this email already exists.":
    "tenantPortal.register.duplicateCustomer",
  "A customer with this document already exists.":
    "tenantPortal.register.duplicateCustomer",
  "A customer with this CPF already exists.":
    "tenantPortal.register.duplicateCustomer",
  "A customer with this phone already exists.":
    "tenantPortal.register.duplicateCustomer",
  "A customer with the same email, document, or phone already exists.":
    "tenantPortal.register.duplicateCustomer",
}

export function localizeCustomerAuthError(raw: string): string {
  const key = CUSTOMER_AUTH_ERROR_KEYS[raw.trim()]
  return key ? i18n.t(key) : raw
}

export function parseCustomerAuthError(
  payload: unknown,
  fallbackMessage: string,
): string {
  const parsed = parseApiError(payload, "")
  if (!parsed) {
    return fallbackMessage
  }
  return localizeCustomerAuthError(parsed)
}
