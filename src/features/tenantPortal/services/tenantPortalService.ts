import { api, getAxiosErrorPayload, parseApiError } from "@/lib/api"
import {
  authResponseSchema,
  registerResponseSchema,
  tenantBrandingSchema,
  type CustomerAuthResponse,
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

/** Resolves tenant slug from host (`x.rolvix.com.br`) or path `/t/:subdomain`. */
export function resolveTenantSubdomain(pathname: string): string | null {
  const pathMatch = pathname.match(/^\/t\/([a-z0-9-]+)(?:\/|$)/i)
  if (pathMatch?.[1]) {
    return pathMatch[1].toLowerCase()
  }

  const host = window.location.hostname.toLowerCase()
  const base = getTenantBaseDomain()

  if (host === base || host === `www.${base}` || host === "localhost" || host === "127.0.0.1") {
    return null
  }

  if (host.endsWith(`.${base}`)) {
    const slug = host.slice(0, -(base.length + 1))
    if (slug.length > 0 && !slug.includes(".")) {
      return slug
    }
  }

  // Local wildcard: quadratenis.localhost
  if (host.endsWith(".localhost")) {
    const slug = host.slice(0, -".localhost".length)
    if (slug.length > 0 && !slug.includes(".")) {
      return slug
    }
  }

  return null
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

export async function registerCustomer(
  subdomain: string,
  body: {
    name: string
    email: string
    password: string
    cpf: string
    postalCode: string
    phone: string
    photoUrl: string
  },
): Promise<{ customerId: string; requiresPhoneVerification: boolean }> {
  try {
    const response = await api.post(
      "/api/auth/customer/register",
      body,
      { headers: subdomainHeaders(subdomain) },
    )
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
