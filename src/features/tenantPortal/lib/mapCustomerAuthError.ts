import { parseApiError } from "@/lib/api"
import i18n from "@/lib/i18n"

export type CustomerDuplicateField = "email" | "document" | "phone"

const CUSTOMER_AUTH_ERROR_KEYS: Record<string, string> = {
  "Invalid email or password.": "tenantPortal.login.invalidCredentials",
  "Invalid email or password": "tenantPortal.login.invalidCredentials",
  "Invalid login credentials": "tenantPortal.login.invalidCredentials",
  "Email is not verified. Complete email verification first.":
    "tenantPortal.login.emailNotVerified",
  "Invalid or expired verification code.":
    "tenantPortal.verify.invalidOrExpired",
  "Password must be at least 8 characters.":
    "tenantPortal.validation.passwordMin",
  "Too many verification attempts. Try again shortly.":
    "tenantPortal.passwordReset.rateLimited",
  "A customer with this email already exists.":
    "tenantPortal.register.duplicateEmail",
  "A customer with this document already exists.":
    "tenantPortal.register.duplicateDocument",
  "A customer with this CPF already exists.":
    "tenantPortal.register.duplicateDocument",
  "A customer with this phone already exists.":
    "tenantPortal.register.duplicatePhone",
  "A customer with the same email, document, or phone already exists.":
    "tenantPortal.register.duplicateCustomer",
}

const CUSTOMER_AUTH_ERROR_FIELDS: Record<string, CustomerDuplicateField> = {
  "A customer with this email already exists.": "email",
  "A customer with this document already exists.": "document",
  "A customer with this CPF already exists.": "document",
  "A customer with this phone already exists.": "phone",
}

export function localizeCustomerAuthError(raw: string): string {
  const key = CUSTOMER_AUTH_ERROR_KEYS[raw.trim()]
  return key ? i18n.t(key) : raw
}

/** Which registration field a duplicate-record error points to, when the backend message is specific enough. */
export function customerDuplicateField(
  raw: string,
): CustomerDuplicateField | null {
  return CUSTOMER_AUTH_ERROR_FIELDS[raw.trim()] ?? null
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

export function parseCustomerAuthErrorField(
  payload: unknown,
): CustomerDuplicateField | null {
  const parsed = parseApiError(payload, "")
  if (!parsed) {
    return null
  }
  return customerDuplicateField(parsed)
}
