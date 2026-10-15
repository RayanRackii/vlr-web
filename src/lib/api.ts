import axios, { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from "axios"
import { z } from "zod"

import {
  logAuthSessionEvent,
  readJwtExpiresAt,
  requestPathWithoutQuery,
} from "@/lib/authSessionLog"
import { assignBrowserLocation } from "@/lib/browserLocation"
import { supabase } from "@/lib/supabase"

declare module "axios" {
  interface AxiosRequestConfig {
    rolvixStaffAuthRetry?: boolean
    rolvixCustomerAuthRetry?: boolean
  }
}

const DEFAULT_API_BASE_URL = "http://localhost:5298"

/** Must match `CUSTOMER_TOKEN_KEY` in tenantPortalService. */
const CUSTOMER_TOKEN_STORAGE_KEY = "rolvix.customer.token"
const CUSTOMER_SUBDOMAIN_STORAGE_KEY = "rolvix.customer.subdomain"
const CUSTOMER_LABEL_STORAGE_KEY = "rolvix.customer.label"

const apiErrorSchema = z.object({
  error: z.string(),
})

type StaffRefreshResult =
  | { ok: true; accessToken: string }
  | { ok: false; error: unknown }

let staffRefreshInflight: Promise<StaffRefreshResult> | null = null

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

/** B2C tenant portal: Customer JWT only (localStorage). */
export const customerApi = createApiClient()

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

/** Drops a shared staff refresh left in flight. Tests only. */
export function resetStaffSessionRefreshForTests(): void {
  staffRefreshInflight = null
}

function authorizationHeader(
  config: InternalAxiosRequestConfig | undefined,
): string | null {
  if (!config?.headers) {
    return null
  }

  const headers = config.headers
  if (typeof headers.get === "function") {
    const value = headers.get("Authorization")
    if (typeof value === "string" && value.trim().length > 0) {
      return value
    }
  }

  const direct = headers.Authorization ?? headers.authorization
  if (typeof direct === "string" && direct.trim().length > 0) {
    return direct
  }

  return null
}

function isBearerAuthorization(value: string | null): boolean {
  return value !== null && /^Bearer\s+\S+/i.test(value)
}

function setAuthorization(
  config: InternalAxiosRequestConfig,
  accessToken: string,
): void {
  const value = `Bearer ${accessToken}`
  if (typeof config.headers.set === "function") {
    config.headers.set("Authorization", value)
    return
  }

  config.headers.Authorization = value
}

function responseStatus(error: AxiosError): number | null {
  const status = error.response?.status
  return typeof status === "number" ? status : null
}

function logApi401(
  surface: "b2b" | "b2c",
  config: InternalAxiosRequestConfig | undefined,
  error?: unknown,
): void {
  const authorization = authorizationHeader(config)
  logAuthSessionEvent({
    event: "API_401",
    surface,
    hadSession: isBearerAuthorization(authorization),
    expiresAt: readJwtExpiresAt(authorization),
    error,
    httpStatus: 401,
    requestPath: requestPathWithoutQuery(config?.url),
  })
}

async function performStaffRefresh(): Promise<StaffRefreshResult> {
  try {
    const result = await supabase.auth.refreshSession()
    if (result.error) {
      return { ok: false, error: result.error }
    }

    const accessToken = result.data?.session?.access_token
    if (typeof accessToken !== "string" || accessToken.trim().length === 0) {
      return { ok: false, error: null }
    }

    return { ok: true, accessToken }
  } catch (error: unknown) {
    return { ok: false, error }
  }
}

function refreshStaffSession(): Promise<StaffRefreshResult> {
  if (staffRefreshInflight) {
    return staffRefreshInflight
  }

  staffRefreshInflight = performStaffRefresh().finally(() => {
    staffRefreshInflight = null
  })
  return staffRefreshInflight
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

api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  if (
    config.rolvixStaffAuthRetry === true &&
    isBearerAuthorization(authorizationHeader(config))
  ) {
    return config
  }

  const { data } = await supabase.auth.getSession()
  const accessToken = data?.session?.access_token

  if (typeof accessToken === "string" && accessToken.length > 0) {
    setAuthorization(config, accessToken)
  }

  return config
})

api.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!isAxiosError(error) || responseStatus(error) !== 401) {
      return Promise.reject(error)
    }

    const config = error.config
    const authorization = authorizationHeader(config)
    const hadBearer = isBearerAuthorization(authorization)
    if (!config || !hadBearer || config.rolvixStaffAuthRetry === true) {
      logApi401("b2b", config)
      return Promise.reject(error)
    }

    // One refresh for this 401. A new access token retries the request once.
    // Network/5xx and terminal auth failures both reject the original error.
    // Do not call signOut: a terminal refresh already emits SIGNED_OUT, and a
    // retryable failure must keep the current session.
    const refresh = await refreshStaffSession()
    logApi401("b2b", config, refresh.ok ? undefined : refresh.error)
    if (!refresh.ok) {
      return Promise.reject(error)
    }

    config.rolvixStaffAuthRetry = true
    setAuthorization(config, refresh.accessToken)
    return api.request(config)
  },
)

customerApi.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const accessToken =
    typeof window !== "undefined"
      ? window.localStorage.getItem(CUSTOMER_TOKEN_STORAGE_KEY)
      : null

  if (typeof accessToken === "string" && accessToken.length > 0) {
    setAuthorization(config, accessToken)
  }

  return config
})

customerApi.interceptors.response.use(
  (response) => response,
  async (error: unknown): Promise<AxiosResponse> => {
    if (!isAxiosError(error) || responseStatus(error) !== 401) {
      return Promise.reject(error)
    }

    const config = error.config
    const hadBearer = isBearerAuthorization(authorizationHeader(config))
    logApi401("b2c", config)

    if (!config || !hadBearer || typeof window === "undefined") {
      return Promise.reject(error)
    }

    if (config.rolvixCustomerAuthRetry === true) {
      clearCustomerSessionStorage()
      if (!isCustomerLoginPath(window.location.pathname)) {
        assignBrowserLocation(customerLoginPath())
      }
      return Promise.reject(error)
    }

    config.rolvixCustomerAuthRetry = true
    return customerApi.request(config)
  },
)
