import { z } from "zod"

import { api, getAxiosErrorPayload, parseApiError } from "@/lib/api"
import {
  authResponseSchema,
  registerResponseSchema,
  registrationFieldSchema,
  registrationSchemaResponseSchema,
  tenantBrandingSchema,
  type CustomerAuthResponse,
  type RegistrationField,
  type RegistrationSchemaResponse,
  type TenantBranding,
} from "@/features/tenantPortal/schemas/tenantPortalSchemas"

const CUSTOMER_TOKEN_KEY = "rolvix.customer.token"
const CUSTOMER_SUBDOMAIN_KEY = "rolvix.customer.subdomain"

export function getTenantBaseDomain(): string {
  const configured = import.meta.env.VITE_TENANT_BASE_DOMAIN
  if (typeof configured === "string" && configured.trim().length > 0) {
    return configured.trim().toLowerCase()
  }
  return "rolvix.com.br"
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

export type TenantPortalSegment =
  | ""
  | "register"
  | "verify-phone"
  | "app"
  | "agenda"

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

  return segment.length > 0
    ? `/t/${subdomain}/${segment}`
    : `/t/${subdomain}`
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
  const response = await api.get(`/api/public/tenants/${subdomain}/branding`)
  const parsed = tenantBrandingSchema.safeParse(response.data)
  if (!parsed.success) {
    throw new Error("Invalid branding payload.")
  }
  return parsed.data
}

export async function fetchRegistrationSchema(
  subdomain: string,
): Promise<RegistrationSchemaResponse> {
  const response = await api.get(
    `/api/public/tenants/${subdomain}/registration-schema`,
  )
  const parsed = registrationSchemaResponseSchema.safeParse(response.data)
  if (!parsed.success) {
    throw new Error("Invalid registration schema payload.")
  }
  return parsed.data
}

export async function registerCustomer(
  subdomain: string,
  body: {
    name: string
    email: string
    password: string
    phone: string
    attributes?: Record<string, string | number | boolean>
  },
): Promise<{ customerId: string; requiresPhoneVerification: boolean }> {
  try {
    const response = await api.post("/api/auth/customer/register", body, {
      headers: subdomainHeaders(subdomain),
    })
    const parsed = registerResponseSchema.safeParse(response.data)
    if (!parsed.success) {
      throw new Error("Invalid register response.")
    }
    return parsed.data
  } catch (error) {
    throw new Error(
      parseApiError(getAxiosErrorPayload(error), "Could not register."),
    )
  }
}

export async function listTenantRegistrationFields(): Promise<
  RegistrationField[]
> {
  const response = await api.get("/api/registration-fields")
  const parsed = z.array(registrationFieldSchema).safeParse(response.data)
  if (!parsed.success) {
    throw new Error("Invalid registration fields payload.")
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
    throw new Error("Invalid registration fields payload.")
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
      throw new Error("Invalid create field response.")
    }
    return parsed.data
  } catch (error) {
    throw new Error(
      parseApiError(getAxiosErrorPayload(error), "Could not create field."),
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
      parseApiError(getAxiosErrorPayload(error), "Could not delete field."),
    )
  }
}

export async function verifyCustomerPhone(
  subdomain: string,
  body: { email: string; code: string },
): Promise<CustomerAuthResponse> {
  try {
    const response = await api.post(
      "/api/auth/customer/verify-phone",
      body,
      { headers: subdomainHeaders(subdomain) },
    )
    const parsed = authResponseSchema.safeParse(response.data)
    if (!parsed.success) {
      throw new Error("Invalid verify-phone response.")
    }
    persistCustomerSession(parsed.data.token, subdomain)
    return parsed.data
  } catch (error) {
    throw new Error(
      parseApiError(getAxiosErrorPayload(error), "Could not verify phone."),
    )
  }
}

export async function loginCustomer(
  subdomain: string,
  body: { email: string; password: string },
): Promise<CustomerAuthResponse> {
  try {
    const response = await api.post(
      "/api/auth/customer/login",
      body,
      { headers: subdomainHeaders(subdomain) },
    )
    const parsed = authResponseSchema.safeParse(response.data)
    if (!parsed.success) {
      throw new Error("Invalid login response.")
    }
    persistCustomerSession(parsed.data.token, subdomain)
    return parsed.data
  } catch (error) {
    throw new Error(
      parseApiError(getAxiosErrorPayload(error), "Could not sign in."),
    )
  }
}

export function persistCustomerSession(token: string, subdomain: string): void {
  window.localStorage.setItem(CUSTOMER_TOKEN_KEY, token)
  window.localStorage.setItem(CUSTOMER_SUBDOMAIN_KEY, subdomain)
}

export function clearCustomerSession(): void {
  window.localStorage.removeItem(CUSTOMER_TOKEN_KEY)
  window.localStorage.removeItem(CUSTOMER_SUBDOMAIN_KEY)
}

export function getCustomerAccessToken(): string | null {
  return window.localStorage.getItem(CUSTOMER_TOKEN_KEY)
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
    throw new Error("Could not process image.")
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
  createdAt: z.string(),
  updatedAt: z.string().nullable().optional(),
})

export type PortalRentalAsset = z.infer<typeof rentalAssetSchema>

const availabilitySchema = z.object({
  isAvailable: z.boolean(),
  requestedQuantity: z.number(),
  availableQuantity: z.number(),
  estimatedTotalAmount: z.number().nullable(),
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
  totalAmount: z.number(),
  depositPaid: z.number(),
  createdAt: z.string(),
  items: z.array(
    z.object({
      id: z.string().uuid(),
      assetId: z.string().uuid(),
      rentalAssetId: z.string().uuid(),
      assetName: z.string(),
      quantity: z.number(),
      unitPrice: z.number(),
      subTotal: z.number(),
    }),
  ),
})

export type PortalReservation = z.infer<typeof reservationSchema>

export async function fetchPortalRentalAssets(
  subdomain: string,
): Promise<PortalRentalAsset[]> {
  const response = await api.get(
    `/api/public/tenants/${subdomain}/rental-assets`,
  )
  const parsed = z.array(rentalAssetSchema).safeParse(response.data)
  if (!parsed.success) {
    throw new Error("Invalid rental assets payload.")
  }
  return parsed.data
}

export async function checkPortalAvailability(
  subdomain: string,
  query: {
    assetId: string
    date: string
    startTime: string
    endTime: string
    quantity?: number
  },
) {
  try {
    const response = await api.get("/api/reservations/availability", {
      params: query,
      headers: subdomainHeaders(subdomain),
    })
    const parsed = availabilitySchema.safeParse(response.data)
    if (!parsed.success) {
      throw new Error("Invalid availability payload.")
    }
    return parsed.data
  } catch (error) {
    throw new Error(
      parseApiError(getAxiosErrorPayload(error), "Could not check availability."),
    )
  }
}

export async function createPortalReservation(body: {
  unitId: string
  date: string
  startTime: string
  endTime: string
  items: { assetId: string; quantity: number }[]
}): Promise<PortalReservation> {
  try {
    const response = await api.post("/api/reservations", body)
    const parsed = reservationSchema.safeParse(response.data)
    if (!parsed.success) {
      throw new Error("Invalid reservation payload.")
    }
    return parsed.data
  } catch (error) {
    throw new Error(
      parseApiError(getAxiosErrorPayload(error), "Could not create reservation."),
    )
  }
}

export async function listMyPortalReservations(): Promise<PortalReservation[]> {
  try {
    const response = await api.get("/api/reservations/mine")
    const parsed = z.array(reservationSchema).safeParse(response.data)
    if (!parsed.success) {
      throw new Error("Invalid reservations payload.")
    }
    return parsed.data
  } catch (error) {
    throw new Error(
      parseApiError(getAxiosErrorPayload(error), "Could not load reservations."),
    )
  }
}
