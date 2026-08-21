import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios"
import { z } from "zod"

import { supabase } from "@/lib/supabase"

const DEFAULT_API_BASE_URL = "http://localhost:5298"

/** Must match `CUSTOMER_TOKEN_KEY` in tenantPortalService. */
const CUSTOMER_TOKEN_STORAGE_KEY = "rolvix.customer.token"
const CUSTOMER_SUBDOMAIN_STORAGE_KEY = "rolvix.customer.subdomain"
const CUSTOMER_LABEL_STORAGE_KEY = "rolvix.customer.label"

const apiErrorSchema = z.object({
  error: z.string(),
})

export function getApiBaseUrl(): string {
  const configured = import.meta.env.VITE_API_URL

  if (typeof configured === "string" && configured.trim().length > 0) {
    return configured.trim().replace(/\/$/, "")
  }

  return DEFAULT_API_BASE_URL
}

function createApiClient() {
  return axios.create({
    baseURL: getApiBaseUrl(),
    headers: {
      "Content-Type": "application/json",
    },
  })
}

/** AllowAnonymous portal/onboarding calls. Never attaches Authorization. */
export const publicApi = createApiClient()

/** B2B panel: Supabase session JWT only. */
export const api = createApiClient()

api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const { data } = await supabase.auth.getSession()
  const accessToken = data.session?.access_token

  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`
  }

  return config
})

/** B2C tenant portal: Customer JWT only (localStorage). */
export const customerApi = createApiClient()

customerApi.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const accessToken =
    typeof window !== "undefined"
      ? window.localStorage.getItem(CUSTOMER_TOKEN_STORAGE_KEY)
      : null

  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`
  }

  return config
})

export function parseApiError(payload: unknown, fallbackMessage: string): string {
  const parsed = apiErrorSchema.safeParse(payload)

  if (parsed.success) {
    return parsed.data.error
  }

  return fallbackMessage
}

export function getAxiosErrorPayload(error: unknown): unknown {
  if (error instanceof AxiosError) {
    return error.response?.data ?? null
  }

  return null
}

export function isAxiosError(error: unknown): error is AxiosError {
  return error instanceof AxiosError
}

function hadBearerAuthorization(
  config?: InternalAxiosRequestConfig,
): boolean {
  const header = config?.headers?.Authorization
  if (typeof header === "string") {
    return header.trim().length > 0
  }
  return Boolean(header)
}

function customerLoginPath(): string {
  const pathMatch = window.location.pathname.match(/^\/t\/([a-z0-9-]+)(?:\/|$)/i)
  if (pathMatch?.[1]) {
    return `/t/${pathMatch[1].toLowerCase()}`
  }
  return "/"
}

function isCustomerLoginPath(pathname: string): boolean {
  if (pathname === "/") {
    return true
  }
  return /^\/t\/[a-z0-9-]+\/?$/i.test(pathname)
}

function clearCustomerSessionStorage(): void {
  window.localStorage.removeItem(CUSTOMER_TOKEN_STORAGE_KEY)
  window.localStorage.removeItem(CUSTOMER_SUBDOMAIN_STORAGE_KEY)
  window.localStorage.removeItem(CUSTOMER_LABEL_STORAGE_KEY)
}

customerApi.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (
      isAxiosError(error) &&
      error.response?.status === 401 &&
      hadBearerAuthorization(error.config) &&
      typeof window !== "undefined"
    ) {
      clearCustomerSessionStorage()
      if (!isCustomerLoginPath(window.location.pathname)) {
        window.location.assign(customerLoginPath())
      }
    }

    return Promise.reject(error)
  },
)
