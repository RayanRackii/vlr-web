import { PortalSessionExpiredError } from "@/features/tenantPortal/lib/portalSessionError"
import { clearAgendaSelectionNotices } from "@/features/tenantPortal/lib/agendaSelectionNotice"
import {
  CUSTOMER_ID_STORAGE_KEY,
  CUSTOMER_LABEL_STORAGE_KEY,
  CUSTOMER_SUBDOMAIN_STORAGE_KEY,
  CUSTOMER_TENANT_ID_STORAGE_KEY,
  CUSTOMER_TOKEN_STORAGE_KEY,
} from "@/features/tenantPortal/lib/customerSessionIdentity"
import { z } from "zod"
import { pricingUnitSchema } from "@/api/generated/rentalPricing"

import {
  api,
  customerApi,
  publicApi,
  getAxiosErrorPayload,
  isAxiosError,
  parseApiError,
} from "@/lib/api"
import i18n from "@/lib/i18n"
import { parseCustomerAuthError } from "@/features/tenantPortal/lib/mapCustomerAuthError"
import {
  isReservationQueueErrorCode,
  portalBookingErrorFromUnknown,
  RESERVATION_QUEUE_ERROR_CODES,
  type ReservationQueueErrorCode,
} from "@/features/tenantPortal/lib/portalBookingError"
import { getTenantBaseDomain, isProductHostname } from "@/lib/tenantDomain"

export { RESERVATION_QUEUE_ERROR_CODES, type ReservationQueueErrorCode }
import {
  authResponseSchema,
  customerProfileSchema,
  moduleMenuItemSchema,
  registerResponseSchema,
  type RegisterCustomerResponse,
  registrationFieldSchema,
  registrationSchemaResponseSchema,
  tenantBrandingSchema,
  type CustomerAuthResponse,
  type CustomerProfile,
  type ModuleMenuItem,
  type RegistrationField,
  type RegistrationSchemaResponse,
  type TenantBranding,
} from "@/features/tenantPortal/schemas/tenantPortalSchemas"

/** Must match `CUSTOMER_TENANT_ID_STORAGE_KEY` in `src/lib/api.ts`. */
const PENDING_EMAIL_VERIFICATION_KEY_PREFIX =
  "rolvix.customer.pendingEmailVerification"

export type PendingEmailVerification = {
  email: string
  verificationSendFailed: boolean
}

export class CustomerLoginRateLimitedError extends Error {
  readonly retryAfterSeconds: number | null

  constructor(retryAfterSeconds: number | null) {
    super("Customer login is rate limited")
    this.name = "CustomerLoginRateLimitedError"
    this.retryAfterSeconds = retryAfterSeconds
  }
}

export function pendingEmailVerificationStorageKey(subdomain: string): string {
  return `${PENDING_EMAIL_VERIFICATION_KEY_PREFIX}.${subdomain.trim().toLowerCase()}`
}

export function persistPendingEmailVerification(
  subdomain: string,
  payload: PendingEmailVerification,
): void {
  const email = payload.email.trim()
  if (email.length === 0) {
    return
  }

  const stored: PendingEmailVerification = {
    email,
    verificationSendFailed: payload.verificationSendFailed === true,
  }
  window.sessionStorage.setItem(
    pendingEmailVerificationStorageKey(subdomain),
    JSON.stringify(stored),
  )
}

export function readPendingEmailVerification(
  subdomain: string,
): PendingEmailVerification | null {
  const raw = window.sessionStorage.getItem(
    pendingEmailVerificationStorageKey(subdomain),
  )
  if (!raw) {
    return null
  }

  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== "object" || parsed === null) {
      return null
    }
    const record = parsed as Record<string, unknown>
    const email = typeof record.email === "string" ? record.email.trim() : ""
    const emailParsed = z.string().trim().email().safeParse(email)
    if (!emailParsed.success) {
      return null
    }
    return {
      email: emailParsed.data,
      verificationSendFailed: record.verificationSendFailed === true,
    }
  } catch {
    return null
  }
}

export function clearPendingEmailVerification(subdomain: string): void {
  window.sessionStorage.removeItem(pendingEmailVerificationStorageKey(subdomain))
}

/** Tenant slug from hostname only (`ficc.rolvix.com.br` → `ficc`). */
export function getHostTenantSubdomain(): string | null {
  const host = window.location.hostname.toLowerCase()
  const base = getTenantBaseDomain()

  if (
    host === base ||
    host === `www.${base}` ||
    host === "localhost" ||
    host === "127.0.0.1"
  ) {
    return null
  }

  if (host.endsWith(`.${base}`)) {
    const slug = host.slice(0, -(base.length + 1))
    if (slug.length > 0 && !slug.includes(".")) {
      return slug
    }
  }

  // Local wildcard: ficc.localhost
  if (host.endsWith(".localhost")) {
    const slug = host.slice(0, -".localhost".length)
    if (slug.length > 0 && !slug.includes(".")) {
      return slug
    }
  }

  return null
}

/** True when the app is served on `{subdomain}.{baseDomain}` (not apex). */
export function isTenantHostMode(): boolean {
  return getHostTenantSubdomain() !== null
}

/** Same charset `customerLoginPath` accepts from `/t/:subdomain`. */
const PORTAL_SLUG_PATTERN = /^[a-z0-9-]+$/

function portalSlug(subdomain: string): string | null {
  const slug = subdomain.trim().toLowerCase()
  return PORTAL_SLUG_PATTERN.test(slug) ? slug : null
}

export type TenantPortalSegment =
  | ""
  | "register"
  | "verify-email"
  | "forgot-password"
  | "forgot-password/confirm"
  | "app"
  | "app/perfil"
  | "agenda"
  | `agenda/${string}`
  | "catalogo"
  | `catalogo/${string}`
  | "pedidos"
  | `pedidos/${string}`

/**
 * Portal URLs: on host mode → `/`, `/register`, …;
 * on apex/dev path mode → `/t/{subdomain}`, `/t/{subdomain}/register`, …
 */
export function tenantPortalPath(
  subdomain: string,
  segment: TenantPortalSegment = "",
): string {
  if (isTenantHostMode()) {
    return segment.length > 0 ? `/${segment}` : "/"
  }

  return tenantPortalPathMode(subdomain, segment)
}

/** Path-mode portal path (`/t/:subdomain/...`), regardless of the current host. */
export function tenantPortalPathMode(
  subdomain: string,
  segment: TenantPortalSegment = "",
): string {
  const slug = portalSlug(subdomain)
  if (slug === null) {
    return "/"
  }
  return segment.length > 0 ? `/t/${slug}/${segment}` : `/t/${slug}`
}

export type TenantPortalHrefOptions = {
  origin?: string
  hostname?: string
}

/**
 * Absolute tenant portal URL.
 * Product domains → `https://{subdomain}.{baseDomain}/{segment}` (host-mode).
 * Preview, localhost, and other origins → `{origin}/t/{subdomain}/{segment}` (path-mode).
 */
export function tenantPortalHref(
  subdomain: string,
  segment: TenantPortalSegment = "",
  options?: TenantPortalHrefOptions,
): string {
  const slug = portalSlug(subdomain)
  const segmentPath = segment.length > 0 ? `/${segment}` : ""

  const hostname =
    options?.hostname ??
    (typeof window !== "undefined" ? window.location.hostname : "localhost")
  const origin =
    options?.origin ??
    (typeof window !== "undefined"
      ? window.location.origin
      : "http://localhost:5173")
  const safeOrigin = origin.replace(/\/+$/, "")

  if (slug === null) {
    return `${safeOrigin}/`
  }

  if (isProductHostname(hostname)) {
    const base = getTenantBaseDomain()
    return `https://${slug}.${base}${segmentPath}`
  }

  const path = tenantPortalPathMode(slug, segment)
  return `${safeOrigin}${path}`
}

/** Placeholder for empty subdomain fields in admin forms. */
export function tenantPortalHrefPlaceholder(
  options?: TenantPortalHrefOptions,
): string {
  const hostname =
    options?.hostname ??
    (typeof window !== "undefined" ? window.location.hostname : "localhost")
  const origin =
    options?.origin ??
    (typeof window !== "undefined"
      ? window.location.origin
      : "http://localhost:5173")
  const base = getTenantBaseDomain()

  if (isProductHostname(hostname)) {
    return `{subdomain}.${base}`
  }

  return `${origin.replace(/\/+$/, "")}/t/{subdomain}`
}

export function menuItemAgendaPath(
  subdomain: string,
  menuItemId: string,
): string {
  return tenantPortalPath(subdomain, `agenda/${menuItemId}`)
}

/** Resolves tenant slug from host (`x.rolvix.com.br`) or path `/t/:subdomain`. */
export function resolveTenantSubdomain(pathname: string): string | null {
  const pathMatch = pathname.match(/^\/t\/([a-z0-9-]+)(?:\/|$)/i)
  if (pathMatch?.[1]) {
    return pathMatch[1].toLowerCase()
  }

  return getHostTenantSubdomain()
}

function subdomainHeaders(subdomain: string): Record<string, string> {
  return { "X-Tenant-Subdomain": subdomain }
}

export async function fetchTenantBranding(
  subdomain: string,
): Promise<TenantBranding> {
  const response = await publicApi.get(`/api/public/tenants/${subdomain}/branding`)
  const parsed = tenantBrandingSchema.safeParse(response.data)
  if (!parsed.success) {
    throw new Error(i18n.t("apiErrors.invalidPayload"))
  }
  return parsed.data
}

export async function fetchRegistrationSchema(
  subdomain: string,
): Promise<RegistrationSchemaResponse> {
  const response = await publicApi.get(
    `/api/public/tenants/${subdomain}/registration-schema`,
  )
  const parsed = registrationSchemaResponseSchema.safeParse(response.data)
  if (!parsed.success) {
    throw new Error(i18n.t("apiErrors.invalidPayload"))
  }
  return parsed.data
}

/** Well-known nil UUID. Used when a legacy 503 has no customerId; the page navigates by email. */
const NIL_CUSTOMER_ID = "00000000-0000-0000-0000-000000000000"

const LEGACY_REGISTER_SEND_FAILED: RegisterCustomerResponse = {
  customerId: NIL_CUSTOMER_ID,
  requiresEmailVerification: true,
  requiresPhoneVerification: true,
  verificationStarted: false,
}

export async function registerCustomer(
  subdomain: string,
  body: {
    name: string
    email: string
    password: string
    phone: string
    customerType: "Individual" | "Company"
    document: string
    attributes?: Record<string, string | number | boolean>
  },
): Promise<RegisterCustomerResponse> {
  try {
    const response = await publicApi.post("/api/auth/customer/register", body, {
      headers: subdomainHeaders(subdomain),
    })
    const parsed = registerResponseSchema.safeParse(response.data)
    if (!parsed.success) {
      throw new Error(i18n.t("apiErrors.invalidResponse"))
    }
    return parsed.data
  } catch (error) {
    if (isAxiosError(error) && error.response?.status === 503) {
      return LEGACY_REGISTER_SEND_FAILED
    }
    if (error instanceof Error && !isAxiosError(error)) {
      throw error
    }
    throw new Error(
      parseCustomerAuthError(
        getAxiosErrorPayload(error),
        i18n.t("apiErrors.register"),
      ),
    )
  }
}

export async function listTenantRegistrationFields(): Promise<
  RegistrationField[]
> {
  const response = await api.get("/api/registration-fields")
  const parsed = z.array(registrationFieldSchema).safeParse(response.data)
  if (!parsed.success) {
    throw new Error(i18n.t("apiErrors.invalidPayload"))
  }
  return parsed.data
}

export async function listAdminRegistrationFields(
  tenantId: string,
): Promise<RegistrationField[]> {
  const response = await api.get(
    `/api/admin/tenants/${tenantId}/registration-fields`,
  )
  const parsed = z.array(registrationFieldSchema).safeParse(response.data)
  if (!parsed.success) {
    throw new Error(i18n.t("apiErrors.invalidPayload"))
  }
  return parsed.data
}

export async function createRegistrationField(
  body: {
    fieldKey: string
    label: string
    fieldType: string
    isRequired: boolean
    sortOrder: number
    options?: string[] | null
  },
  tenantId?: string,
): Promise<RegistrationField> {
  const url = tenantId
    ? `/api/admin/tenants/${tenantId}/registration-fields`
    : "/api/registration-fields"
  try {
    const response = await api.post(url, body)
    const parsed = registrationFieldSchema.safeParse(response.data)
    if (!parsed.success) {
      throw new Error(i18n.t("apiErrors.invalidResponse"))
    }
    return parsed.data
  } catch (error) {
    throw new Error(
      parseApiError(getAxiosErrorPayload(error), i18n.t("apiErrors.createField")),
    )
  }
}

export async function updateRegistrationField(
  fieldId: string,
  body: {
    label: string
    fieldType: string
    isRequired: boolean
    sortOrder: number
    options?: string[] | null
  },
  tenantId?: string,
): Promise<RegistrationField> {
  const url = tenantId
    ? `/api/admin/tenants/${tenantId}/registration-fields/${fieldId}`
    : `/api/registration-fields/${fieldId}`
  try {
    const response = await api.put(url, body)
    const parsed = registrationFieldSchema.safeParse(response.data)
    if (!parsed.success) {
      throw new Error(i18n.t("apiErrors.invalidResponse"))
    }
    return parsed.data
  } catch (error) {
    if (error instanceof Error && !isAxiosError(error)) {
      throw error
    }
    throw new Error(
      parseApiError(getAxiosErrorPayload(error), i18n.t("apiErrors.updateField")),
    )
  }
}

export async function deleteRegistrationField(
  fieldId: string,
  tenantId?: string,
): Promise<void> {
  const url = tenantId
    ? `/api/admin/tenants/${tenantId}/registration-fields/${fieldId}`
    : `/api/registration-fields/${fieldId}`
  try {
    await api.delete(url)
  } catch (error) {
    throw new Error(
      parseApiError(getAxiosErrorPayload(error), i18n.t("apiErrors.deleteField")),
    )
  }
}

export async function resendCustomerEmailVerification(
  subdomain: string,
  body: { email: string },
): Promise<void> {
  try {
    await publicApi.post(
      "/api/auth/customer/resend-verification",
      { email: body.email },
      { headers: subdomainHeaders(subdomain) },
    )
  } catch (error) {
    throw new Error(
      parseCustomerAuthError(
        getAxiosErrorPayload(error),
        i18n.t("apiErrors.resendEmailVerification"),
      ),
    )
  }
}

export async function verifyCustomerEmail(
  subdomain: string,
  body: { email: string; code: string },
): Promise<CustomerAuthResponse> {
  try {
    const response = await publicApi.post(
      "/api/auth/customer/verify-email",
      body,
      { headers: subdomainHeaders(subdomain) },
    )
    const parsed = authResponseSchema.safeParse(response.data)
    if (!parsed.success) {
      throw new Error(i18n.t("apiErrors.invalidResponse"))
    }
    persistCustomerSession(
      parsed.data.token,
      subdomain,
      parsed.data.customer.email ?? parsed.data.customer.name,
      parsed.data.customer.id,
      parsed.data.customer.tenantId,
    )
    return parsed.data
  } catch (error) {
    throw new Error(
      parseCustomerAuthError(
        getAxiosErrorPayload(error),
        i18n.t("apiErrors.verifyEmail"),
      ),
    )
  }
}

export async function requestCustomerPasswordReset(
  subdomain: string,
  body: { email: string },
): Promise<void> {
  try {
    await publicApi.post(
      "/api/auth/customer/password-reset/request",
      { email: body.email },
      { headers: subdomainHeaders(subdomain) },
    )
  } catch (error) {
    throw new Error(
      parseCustomerAuthError(
        getAxiosErrorPayload(error),
        i18n.t("tenantPortal.passwordReset.requestError"),
      ),
    )
  }
}

export async function confirmCustomerPasswordReset(
  subdomain: string,
  body: { email: string; code: string; newPassword: string },
): Promise<void> {
  try {
    await publicApi.post(
      "/api/auth/customer/password-reset/confirm",
      body,
      { headers: subdomainHeaders(subdomain) },
    )
  } catch (error) {
    throw new Error(
      parseCustomerAuthError(
        getAxiosErrorPayload(error),
        i18n.t("tenantPortal.passwordReset.toastError"),
      ),
    )
  }
}

export async function loginCustomer(
  subdomain: string,
  body: { email: string; password: string },
): Promise<CustomerAuthResponse> {
  try {
    const response = await publicApi.post(
      "/api/auth/customer/login",
      body,
      { headers: subdomainHeaders(subdomain) },
    )
    const parsed = authResponseSchema.safeParse(response.data)
    if (!parsed.success) {
      throw new Error(i18n.t("apiErrors.invalidResponse"))
    }
    persistCustomerSession(
      parsed.data.token,
      subdomain,
      parsed.data.customer.email ?? parsed.data.customer.name,
      parsed.data.customer.id,
      parsed.data.customer.tenantId,
    )
    return parsed.data
  } catch (error) {
    if (isAxiosError(error) && error.response?.status === 429) {
      const retryAfter = error.response.headers?.["retry-after"]
      const retryAfterSeconds =
        typeof retryAfter === "string" &&
        Number.isFinite(Number(retryAfter)) &&
        Number(retryAfter) >= 0
          ? Number(retryAfter)
          : null
      throw new CustomerLoginRateLimitedError(retryAfterSeconds)
    }

    throw new Error(
      parseCustomerAuthError(
        getAxiosErrorPayload(error),
        i18n.t("apiErrors.signIn"),
      ),
    )
  }
}

export function persistCustomerSession(
  token: string,
  subdomain: string,
  label?: string,
  customerId?: string,
  tenantId?: string,
): void {
  clearAgendaSelectionNotices()
  window.localStorage.setItem(CUSTOMER_TOKEN_STORAGE_KEY, token)
  window.localStorage.setItem(CUSTOMER_SUBDOMAIN_STORAGE_KEY, subdomain.trim().toLowerCase())
  if (label && label.trim().length > 0) {
    window.localStorage.setItem(CUSTOMER_LABEL_STORAGE_KEY, label.trim())
  }
  if (customerId && customerId.trim().length > 0) {
    window.localStorage.setItem(CUSTOMER_ID_STORAGE_KEY, customerId.trim())
  } else {
    window.localStorage.removeItem(CUSTOMER_ID_STORAGE_KEY)
  }
  const normalizedTenantId = normalizeGuid(tenantId)
  if (normalizedTenantId) {
    window.localStorage.setItem(CUSTOMER_TENANT_ID_STORAGE_KEY, normalizedTenantId)
  } else {
    window.localStorage.removeItem(CUSTOMER_TENANT_ID_STORAGE_KEY)
  }
}

export function clearCustomerSession(): void {
  clearAgendaSelectionNotices()
  window.localStorage.removeItem(CUSTOMER_TOKEN_STORAGE_KEY)
  window.localStorage.removeItem(CUSTOMER_SUBDOMAIN_STORAGE_KEY)
  window.localStorage.removeItem(CUSTOMER_LABEL_STORAGE_KEY)
  window.localStorage.removeItem(CUSTOMER_ID_STORAGE_KEY)
  window.localStorage.removeItem(CUSTOMER_TENANT_ID_STORAGE_KEY)
}

export function getCustomerAccessToken(): string | null {
  const stored = window.localStorage.getItem(CUSTOMER_TOKEN_STORAGE_KEY)
  if (stored === null || stored.length === 0) {
    return null
  }
  return stored
}

export function getCustomerSubdomain(): string | null {
  return normalizeTenantSlug(window.localStorage.getItem(CUSTOMER_SUBDOMAIN_STORAGE_KEY))
}

/**
 * Customer session for this portal tenant only.
 * A token saved for another subdomain is not signed in here.
 * When both the saved tenant id and the token `tenant_id` claim are present,
 * they must match. The API still authorizes every request.
 */
export function isCustomerSignedInForTenant(subdomain: string): boolean {
  const slug = normalizeTenantSlug(subdomain)
  const token = getCustomerAccessToken()
  if (slug === null || token === null) {
    return false
  }
  if (getCustomerSubdomain() !== slug) {
    return false
  }

  const storedTenantId = normalizeGuid(
    window.localStorage.getItem(CUSTOMER_TENANT_ID_STORAGE_KEY),
  )
  const tokenTenantId = normalizeGuid(decodeJwtClaim(token, "tenant_id"))
  if (
    storedTenantId !== null &&
    tokenTenantId !== null &&
    storedTenantId !== tokenTenantId
  ) {
    return false
  }

  return true
}

export function getCustomerLabel(): string | null {
  return window.localStorage.getItem(CUSTOMER_LABEL_STORAGE_KEY)
}

export function getCustomerId(): string | null {
  const stored = window.localStorage.getItem(CUSTOMER_ID_STORAGE_KEY)
  if (stored && stored.trim().length > 0) {
    return stored
  }

  return decodeCustomerIdFromToken(getCustomerAccessToken())
}

function normalizeTenantSlug(value: string | null | undefined): string | null {
  const slug = value?.trim().toLowerCase() ?? ""
  return slug.length > 0 ? slug : null
}

function normalizeGuid(value: string | null | undefined): string | null {
  const guid = value?.trim().toLowerCase() ?? ""
  return guid.length > 0 ? guid : null
}

function decodeJwtClaim(token: string | null, claim: string): string | null {
  if (!token) {
    return null
  }

  const payloadPart = token.split(".")[1]
  if (!payloadPart) {
    return null
  }

  try {
    const base64 = payloadPart.replace(/-/g, "+").replace(/_/g, "/")
    const padded = base64.padEnd(
      base64.length + ((4 - (base64.length % 4)) % 4),
      "=",
    )
    const json = window.atob(padded)
    const parsed: unknown = JSON.parse(json)
    if (typeof parsed !== "object" || parsed === null) {
      return null
    }
    const value = (parsed as Record<string, unknown>)[claim]
    return typeof value === "string" && value.trim().length > 0
      ? value.trim()
      : null
  } catch {
    return null
  }
}

function decodeCustomerIdFromToken(token: string | null): string | null {
  return decodeJwtClaim(token, "customer_id")
}

export async function fetchTenantMenu(
  subdomain: string,
): Promise<ModuleMenuItem[]> {
  const response = await publicApi.get(`/api/public/tenants/${subdomain}/menu`)
  const parsed = z.array(moduleMenuItemSchema).safeParse(response.data)
  if (!parsed.success) {
    throw new Error(i18n.t("apiErrors.invalidPayload"))
  }
  return parsed.data
}

export async function listTenantModuleMenuItems(): Promise<ModuleMenuItem[]> {
  const response = await api.get("/api/module-menu-items")
  const parsed = z.array(moduleMenuItemSchema).safeParse(response.data)
  if (!parsed.success) {
    throw new Error(i18n.t("apiErrors.invalidPayload"))
  }
  return parsed.data
}

export async function listAdminModuleMenuItems(
  tenantId: string,
): Promise<ModuleMenuItem[]> {
  const response = await api.get(
    `/api/admin/tenants/${tenantId}/module-menu-items`,
  )
  const parsed = z.array(moduleMenuItemSchema).safeParse(response.data)
  if (!parsed.success) {
    throw new Error(i18n.t("apiErrors.invalidPayload"))
  }
  return parsed.data
}

export async function createModuleMenuItem(
  body: {
    moduleName: string
    label: string
    sortOrder: number
    isActive: boolean
    rentalAssetId?: string | null
  },
  tenantId?: string,
): Promise<ModuleMenuItem> {
  const url = tenantId
    ? `/api/admin/tenants/${tenantId}/module-menu-items`
    : "/api/module-menu-items"
  try {
    const response = await api.post(url, body)
    const parsed = moduleMenuItemSchema.safeParse(response.data)
    if (!parsed.success) {
      throw new Error(i18n.t("apiErrors.invalidResponse"))
    }
    return parsed.data
  } catch (error) {
    throw new Error(
      parseApiError(getAxiosErrorPayload(error), i18n.t("apiErrors.createMenuItem")),
    )
  }
}

export async function updateModuleMenuItem(
  itemId: string,
  body: {
    label: string
    sortOrder: number
    isActive: boolean
    rentalAssetId?: string | null
    bookingIdleTimeoutMinutes?: number | null
    bookingIdleRedirectPath?: string | null
  },
  tenantId?: string,
): Promise<ModuleMenuItem> {
  const url = tenantId
    ? `/api/admin/tenants/${tenantId}/module-menu-items/${itemId}`
    : `/api/module-menu-items/${itemId}`
  try {
    const response = await api.put(url, body)
    const parsed = moduleMenuItemSchema.safeParse(response.data)
    if (!parsed.success) {
      throw new Error(i18n.t("apiErrors.invalidResponse"))
    }
    return parsed.data
  } catch (error) {
    throw new Error(
      parseApiError(getAxiosErrorPayload(error), i18n.t("apiErrors.updateMenuItem")),
    )
  }
}

export async function deleteModuleMenuItem(
  itemId: string,
  tenantId?: string,
): Promise<void> {
  const url = tenantId
    ? `/api/admin/tenants/${tenantId}/module-menu-items/${itemId}`
    : `/api/module-menu-items/${itemId}`
  try {
    await api.delete(url)
  } catch (error) {
    throw new Error(
      parseApiError(getAxiosErrorPayload(error), i18n.t("apiErrors.deleteMenuItem")),
    )
  }
}

export type UpdateCustomerProfileRequest = {
  name?: string
  photoUrl?: string | null
}

export async function fetchCustomerProfile(): Promise<CustomerProfile> {
  let response
  try {
    response = await customerApi.get("/api/customers/me")
  } catch (error) {
    throw new Error(
      parseApiError(
        getAxiosErrorPayload(error),
        i18n.t("apiErrors.loadCustomerProfile"),
      ),
    )
  }

  const parsed = customerProfileSchema.safeParse(response.data)
  if (!parsed.success) {
    throw new Error(i18n.t("apiErrors.invalidPayload"))
  }
  return parsed.data
}

export async function updateCustomerProfile(
  body: UpdateCustomerProfileRequest,
): Promise<CustomerProfile> {
  const payload: UpdateCustomerProfileRequest = {}
  if (body.name !== undefined) {
    payload.name = body.name
  }
  if (body.photoUrl !== undefined) {
    payload.photoUrl = body.photoUrl
  }

  let response
  try {
    response = await customerApi.patch("/api/customers/me", payload)
  } catch (error) {
    throw new Error(
      parseApiError(
        getAxiosErrorPayload(error),
        i18n.t("apiErrors.updateCustomerProfile"),
      ),
    )
  }

  const parsed = customerProfileSchema.safeParse(response.data)
  if (!parsed.success) {
    throw new Error(i18n.t("apiErrors.invalidResponse"))
  }
  return parsed.data
}

export async function fileToCompressedDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const maxSide = 512
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext("2d")
  if (!context) {
    throw new Error(i18n.t("apiErrors.processImage"))
  }
  context.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()
  return canvas.toDataURL("image/jpeg", 0.72)
}

const rentalAssetSchema = z.object({
  id: z.string().uuid(),
  assetId: z.string().uuid(),
  tenantId: z.string().uuid(),
  unitId: z.string().uuid(),
  name: z.string(),
  type: z.string(),
  totalQuantity: z.number(),
  isActive: z.boolean(),
  requiresDeposit: z.boolean().optional().default(true),
  queueEnabled: z.boolean().optional().default(false),
  queueOpeningTime: z
    .string()
    .nullable()
    .optional()
    .transform((value) => value || null),
  schedulePolicy: z.string().optional(),
  openTime: z.string().nullable().optional(),
  closeTime: z.string().nullable().optional(),
  allowedDurationMinutes: z.string().nullable().optional(),
  categoryId: z.string().uuid().nullable().optional(),
  categoryName: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string().nullable().optional(),
  cancelCutoffHours: z.number().int().min(0).max(8760).nullable().optional(),
  /** Override, otherwise the tenant policy. Null means no cutoff. */
  effectiveCancelCutoffHours: z.number().int().min(0).max(8760).nullable().optional(),
  /** Stored override. Null inherits the tenant policy. Absent means not sent. */
  maxAdvanceBookingDays: z
    .number()
    .int()
    .min(0)
    .max(3650)
    .nullable()
    .optional(),
  /** Override, otherwise the tenant policy. Null means unlimited. */
  effectiveMaxAdvanceBookingDays: z
    .number()
    .int()
    .min(0)
    .max(3650)
    .nullable()
    .optional(),
})

export type PortalRentalAsset = z.infer<typeof rentalAssetSchema>

const availabilitySchema = z.object({
  isAvailable: z.boolean(),
  requestedQuantity: z.number(),
  availableQuantity: z.number(),
  estimatedTotalAmount: z.number().nullable(),
  pricingUnit: pricingUnitSchema.nullish(),
  unitPrice: z.number().nullable().optional(),
  pricedUnits: z.number().nullable().optional(),
  reason: z.string().nullable(),
})

const reservationSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  unitId: z.string().uuid(),
  customerId: z.string().uuid(),
  customerName: z.string(),
  customerWhatsApp: z.string(),
  startDateTime: z.string(),
  endDateTime: z.string(),
  status: z.string(),
  cancelDeadlineUtc: z.string().datetime({ offset: true }).nullable().optional(),
  totalAmount: z.number(),
  depositPaid: z.number(),
  createdAt: z.string(),
  items: z.array(
    z.object({
      id: z.string().uuid(),
      assetId: z.string().uuid(),
      rentalAssetId: z.string().uuid(),
      assetName: z.string(),
      quantity: z.number().optional(),
      unitPrice: z.number(),
      subTotal: z.number(),
      pricingUnit: pricingUnitSchema.nullish(),
      days: z.number().nullish(),
    }),
  ),
})

export type PortalReservation = z.infer<typeof reservationSchema>

export async function fetchPortalRentalAssets(
  subdomain: string,
): Promise<PortalRentalAsset[]> {
  const response = await publicApi.get(
    `/api/public/tenants/${subdomain}/rental-assets`,
  )
  const parsed = z.array(rentalAssetSchema).safeParse(response.data)
  if (!parsed.success) {
    throw new Error(i18n.t("apiErrors.invalidPayload"))
  }
  return parsed.data
}

export async function checkPortalAvailability(
  subdomain: string,
  query: {
    assetId: string
    date: string
    endDate?: string
    startTime: string
    endTime: string
    quantity?: number
  },
) {
  try {
    const response = await publicApi.get("/api/reservations/availability", {
      params: query,
      headers: subdomainHeaders(subdomain),
    })
    const parsed = availabilitySchema.safeParse(response.data)
    if (!parsed.success) {
      throw new Error(i18n.t("apiErrors.invalidPayload"))
    }
    return parsed.data
  } catch (error) {
    if (error instanceof Error && !isAxiosError(error)) {
      throw error
    }
    throw portalBookingErrorFromUnknown(
      error,
      i18n.t("apiErrors.checkAvailability"),
    )
  }
}

export async function createPortalReservation(body: {
  unitId: string
  date: string
  endDate?: string
  startTime: string
  endTime: string
  items: { assetId: string; quantity: number }[]
  expectedTotalAmount?: number | null
}): Promise<PortalReservation> {
  try {
    const response = await customerApi.post("/api/reservations", body)
    const parsed = reservationSchema.safeParse(response.data)
    if (!parsed.success) {
      throw new Error(i18n.t("apiErrors.invalidPayload"))
    }
    return parsed.data
  } catch (error) {
    throwPortalBookingFailure(error, "apiErrors.createReservation")
  }
}

export async function listMyPortalReservations(): Promise<PortalReservation[]> {
  try {
    const response = await customerApi.get("/api/reservations/mine", {
      headers: {
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
      },
    })
    const parsed = z.array(reservationSchema).safeParse(response.data)
    if (!parsed.success) {
      throw new Error(i18n.t("apiErrors.invalidPayload"))
    }
    return parsed.data
  } catch (error) {
    if (isAxiosError(error) && error.response?.status === 401) {
      throw new PortalSessionExpiredError()
    }
    throw new Error(
      parseApiError(getAxiosErrorPayload(error), i18n.t("apiErrors.loadReservations")),
    )
  }
}

export async function cancelMyPortalReservation(
  id: string,
): Promise<PortalReservation> {
  try {
    const response = await customerApi.post(
      `/api/reservations/mine/${id}/cancel`,
    )
    const parsed = reservationSchema.safeParse(response.data)
    if (!parsed.success) {
      throw new Error(i18n.t("apiErrors.invalidResponse"))
    }
    return parsed.data
  } catch (error) {
    if (isAxiosError(error) && error.response?.status === 401) {
      throw new PortalSessionExpiredError()
    }
    if (error instanceof Error && !isAxiosError(error)) {
      throw error
    }
    throw portalBookingErrorFromUnknown(error, i18n.t("apiErrors.cancelReservation"))
  }
}

const EMPTY_SLOT_ID = "00000000-0000-0000-0000-000000000000"

const scheduleSlotSchema = z.object({
  id: z.string().uuid(),
  rentalAssetId: z.string().uuid(),
  assetName: z.string(),
  date: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  occupancyKindId: z.string().uuid(),
  occupancyKindKey: z.string(),
  occupancyKindLabel: z.string(),
  occupancyKindColorHex: z.string().nullable().optional(),
  isBookableByCustomer: z.boolean(),
  label: z.string().nullable().optional(),
  status: z.string(),
  reservationId: z.string().uuid().nullable().optional(),
  isDerived: z.boolean(),
})

const dayScheduleSchema = z.object({
  date: z.string(),
  slots: z.array(scheduleSlotSchema),
})

export type PortalScheduleSlot = z.infer<typeof scheduleSlotSchema>
export type PortalDaySchedule = z.infer<typeof dayScheduleSchema>

export function isBookablePersistedSlot(slot: PortalScheduleSlot): boolean {
  return (
    slot.isBookableByCustomer &&
    !slot.isDerived &&
    slot.id !== EMPTY_SLOT_ID &&
    slot.status.toLowerCase() === "available"
  )
}

export function formatScheduleTime(value: string): string {
  return value.length >= 5 ? value.slice(0, 5) : value
}

export async function fetchPublicScheduleDay(
  subdomain: string,
  date: string,
  rentalAssetId?: string,
): Promise<PortalDaySchedule> {
  try {
    const response = await publicApi.get(
      `/api/public/tenants/${subdomain}/schedule/days/${date}`,
      {
        params: rentalAssetId ? { rentalAssetId } : undefined,
        headers: {
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
      },
    )
    const parsed = dayScheduleSchema.safeParse(response.data)
    if (!parsed.success) {
      throw new Error(i18n.t("apiErrors.invalidPayload"))
    }
    return parsed.data
  } catch (error) {
    if (error instanceof Error && !isAxiosError(error)) {
      throw error
    }
    throw portalBookingErrorFromUnknown(
      error,
      i18n.t("apiErrors.loadScheduleDay"),
    )
  }
}

export async function bookPortalSlot(body: {
  slotId: string
  unitId: string
  quantity?: number
  expectedTotalAmount?: number | null
}): Promise<PortalReservation> {
  try {
    const response = await customerApi.post("/api/schedule/slots/book", {
      slotId: body.slotId,
      unitId: body.unitId,
      quantity: body.quantity ?? 1,
      expectedTotalAmount: body.expectedTotalAmount ?? undefined,
    })
    const parsed = reservationSchema.safeParse(response.data)
    if (!parsed.success) {
      throw new Error(i18n.t("apiErrors.invalidPayload"))
    }
    return parsed.data
  } catch (error) {
    throwPortalBookingFailure(error, "apiErrors.bookSlot")
  }
}

function throwPortalBookingFailure(error: unknown, fallbackKey: string): never {
  if (error instanceof Error && !isAxiosError(error)) {
    throw error
  }
  throw portalBookingErrorFromUnknown(error, i18n.t(fallbackKey))
}

export const reservationQueueTicketStatusSchema = z.enum([
  "Waiting",
  "Active",
  "Completed",
  "Expired",
  "Cancelled",
])

export const reservationQueuePhaseSchema = z.enum([
  "Closed",
  "WaitingRoom",
  "Open",
])

const reservationQueueTicketSchema = z.object({
  id: z.string().uuid(),
  status: reservationQueueTicketStatusSchema,
  sequence: z.coerce.number(),
  position: z.coerce.number().int(),
  joinedAt: z.string(),
  turnStartedAt: z.string().nullable().optional().default(null),
  turnExpiresAt: z.string().nullable().optional().default(null),
  completedReservationId: z.string().uuid().nullable().optional().default(null),
})

export const reservationQueueStatusSchema = z.object({
  rentalAssetId: z.string().uuid(),
  queueEnabled: z.boolean(),
  openingDate: z.string().nullable().optional().default(null),
  opensAt: z.string().nullable().optional().default(null),
  waitingRoomOpensAt: z.string().nullable().optional().default(null),
  serverNow: z.string(),
  phase: reservationQueuePhaseSchema,
  waitingCount: z.coerce.number().int().nonnegative().optional().default(0),
  aheadCount: z.coerce.number().int().nonnegative().optional().default(0),
  myTicket: reservationQueueTicketSchema.nullable().optional().default(null),
})

export type ReservationQueueTicket = z.infer<typeof reservationQueueTicketSchema>
export type ReservationQueueStatus = z.infer<typeof reservationQueueStatusSchema>

export function getReservationQueueErrorCode(
  error: unknown,
): ReservationQueueErrorCode | null {
  const fromPayload = parseApiError(getAxiosErrorPayload(error), "")
  if (isReservationQueueErrorCode(fromPayload)) {
    return fromPayload
  }
  if (error instanceof Error && isReservationQueueErrorCode(error.message)) {
    return error.message
  }
  return null
}

export function isLocationQueueEnabled(
  asset: PortalRentalAsset | null | undefined,
): boolean {
  return asset?.type === "Location" && asset.queueEnabled === true
}

async function parseQueueStatusResponse(
  data: unknown,
  rentalAssetId: string,
): Promise<ReservationQueueStatus> {
  const parsed = reservationQueueStatusSchema.safeParse(data)
  if (parsed.success) {
    return parsed.data
  }
  return fetchReservationQueue(rentalAssetId)
}

export async function fetchReservationQueue(
  rentalAssetId: string,
): Promise<ReservationQueueStatus> {
  try {
    const response = await customerApi.get(
      `/api/rental-assets/${rentalAssetId}/queue`,
    )
    const parsed = reservationQueueStatusSchema.safeParse(response.data)
    if (!parsed.success) {
      throw new Error(i18n.t("apiErrors.invalidPayload"))
    }
    return parsed.data
  } catch (error) {
    if (error instanceof Error && !isAxiosError(error)) {
      throw error
    }
    const code = getReservationQueueErrorCode(error)
    throw new Error(
      code ??
        parseApiError(getAxiosErrorPayload(error), i18n.t("apiErrors.loadQueue")),
    )
  }
}

function throwQueueMutationError(error: unknown, fallbackKey: string): never {
  if (error instanceof Error && !isAxiosError(error)) {
    throw error
  }
  const code = getReservationQueueErrorCode(error)
  throw new Error(
    code ?? parseApiError(getAxiosErrorPayload(error), i18n.t(fallbackKey)),
  )
}

export async function joinReservationQueue(
  rentalAssetId: string,
): Promise<ReservationQueueStatus> {
  try {
    const response = await customerApi.post(
      `/api/rental-assets/${rentalAssetId}/queue/join`,
    )
    return parseQueueStatusResponse(response.data, rentalAssetId)
  } catch (error) {
    throwQueueMutationError(error, "apiErrors.joinQueue")
  }
}

export async function leaveReservationQueue(
  rentalAssetId: string,
): Promise<ReservationQueueStatus> {
  try {
    const response = await customerApi.post(
      `/api/rental-assets/${rentalAssetId}/queue/leave`,
    )
    return parseQueueStatusResponse(response.data, rentalAssetId)
  } catch (error) {
    throwQueueMutationError(error, "apiErrors.leaveQueue")
  }
}
