import {
  isAuthApiError,
  isAuthRetryableFetchError,
} from "@supabase/supabase-js"
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

/** Must match the customer keys in tenantPortalService. */
const CUSTOMER_TOKEN_STORAGE_KEY = "rolvix.customer.token"
const CUSTOMER_SUBDOMAIN_STORAGE_KEY = "rolvix.customer.subdomain"
const CUSTOMER_LABEL_STORAGE_KEY = "rolvix.customer.label"
const CUSTOMER_ID_STORAGE_KEY = "rolvix.customer.id"

const apiErrorSchema = z.object({
  error: z.string(),
})

type StaffRefreshResult =
  | { ok: true; accessToken: string }
  | { ok: false; error: unknown }

type StaffSessionPrincipal = {
  userId: string
  refreshToken: string
}

type StaffSignOut = typeof supabase.auth.signOut

/**
 * Bumped synchronously at the start of every staff `signOut`.
 * A 401 retry still awaiting refresh must not run after this changes.
 */
let staffAuthEpoch = 0
let staffSignOutEpochInstalled = false
let staffRefreshInflight: Promise<StaffRefreshResult> | null = null
let staffRefreshInflightToken: string | null = null
const staffSenderUserId = new WeakMap<InternalAxiosRequestConfig, string>()

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
  staffRefreshInflightToken = null
  staffAuthEpoch = 0
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
  return bearerToken(value) !== null
}

function bearerToken(authorization: string | null): string | null {
  if (authorization === null) {
    return null
  }

  const match = /^Bearer\s+(\S+)/i.exec(authorization.trim())
  return match?.[1] ?? null
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

function clearAuthorization(config: InternalAxiosRequestConfig): void {
  const headers = config.headers
  if (typeof headers.delete === "function") {
    headers.delete("Authorization")
    return
  }

  delete headers.Authorization
  delete headers.authorization
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

function isMockedSignOut(
  signOut: StaffSignOut,
): signOut is StaffSignOut & {
  mockImplementation: (impl: StaffSignOut) => unknown
  getMockImplementation: () => StaffSignOut | undefined
} {
  const candidate = signOut as StaffSignOut & {
    mock?: unknown
    mockImplementation?: unknown
    getMockImplementation?: unknown
  }

  return (
    typeof candidate.mock === "object" &&
    candidate.mock !== null &&
    typeof candidate.mockImplementation === "function" &&
    typeof candidate.getMockImplementation === "function"
  )
}

function installStaffSignOutEpochBump(): void {
  if (staffSignOutEpochInstalled) {
    return
  }

  staffSignOutEpochInstalled = true
  const current = supabase.auth.signOut

  if (isMockedSignOut(current)) {
    const initial = current.getMockImplementation()
    current.mockImplementation((options) => {
      staffAuthEpoch += 1
      if (initial) {
        return initial(options)
      }
      return Promise.resolve({ error: null })
    })
    return
  }

  const bound = current.bind(supabase.auth)
  const auth = supabase.auth as { signOut: StaffSignOut }
  auth.signOut = (options) => {
    staffAuthEpoch += 1
    return bound(options)
  }
}

installStaffSignOutEpochBump()

function isTerminalStaffRefreshError(error: unknown): boolean {
  if (isAuthRetryableFetchError(error)) {
    return false
  }

  if (typeof error !== "object" || error === null) {
    return false
  }

  const record = error as {
    status?: unknown
    code?: unknown
    message?: unknown
  }
  const status =
    typeof record.status === "number" && Number.isFinite(record.status)
      ? record.status
      : null
  if (status === 0 || (status !== null && status >= 500)) {
    return false
  }

  const code = typeof record.code === "string" ? record.code.toLowerCase() : ""
  const message =
    typeof record.message === "string" ? record.message.toLowerCase() : ""
  if (
    code === "refresh_token_not_found" ||
    code === "invalid_grant" ||
    message.includes("invalid grant") ||
    message.includes("refresh_token_not_found")
  ) {
    return true
  }

  return isAuthApiError(error) && (status === 400 || status === 401)
}

async function readStaffSessionPrincipal(): Promise<StaffSessionPrincipal | null> {
  try {
    const { data } = await supabase.auth.getSession()
    const session = data?.session
    const userId = session?.user?.id
    const refreshToken = session?.refresh_token
    if (typeof userId !== "string" || userId.length === 0) {
      return null
    }
    if (typeof refreshToken !== "string" || refreshToken.length === 0) {
      return null
    }
    return { userId, refreshToken }
  } catch {
    return null
  }
}

async function readStaffUserId(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession()
    const userId = data?.session?.user?.id
    return typeof userId === "string" && userId.length > 0 ? userId : null
  } catch {
    return null
  }
}

async function performStaffRefresh(
  refreshToken: string,
): Promise<StaffRefreshResult> {
  try {
    const result = await supabase.auth.refreshSession({
      refresh_token: refreshToken,
    })
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

function refreshStaffSession(refreshToken: string): Promise<StaffRefreshResult> {
  if (staffRefreshInflight && staffRefreshInflightToken === refreshToken) {
    return staffRefreshInflight
  }

  if (staffRefreshInflight) {
    return staffRefreshInflight.then(
      () => refreshStaffSession(refreshToken),
      () => refreshStaffSession(refreshToken),
    )
  }

  staffRefreshInflightToken = refreshToken
  const promise = performStaffRefresh(refreshToken).finally(() => {
    if (staffRefreshInflight === promise) {
      staffRefreshInflight = null
      staffRefreshInflightToken = null
    }
  })
  staffRefreshInflight = promise
  return promise
}

function staffPrincipalStill(
  epoch: number,
  senderUserId: string,
  currentUserId: string | null,
): boolean {
  return staffAuthEpoch === epoch && currentUserId === senderUserId
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
  window.localStorage.removeItem(CUSTOMER_ID_STORAGE_KEY)
}

function readStoredCustomerToken(): string | null {
  if (typeof window === "undefined") {
    return null
  }

  const stored = window.localStorage.getItem(CUSTOMER_TOKEN_STORAGE_KEY)
  if (typeof stored !== "string" || stored.length === 0) {
    return null
  }

  return stored
}

function rememberStaffSender(
  config: InternalAxiosRequestConfig,
  accessToken: string,
  userId: string | undefined,
): void {
  setAuthorization(config, accessToken)
  if (typeof userId === "string" && userId.length > 0) {
    staffSenderUserId.set(config, userId)
    return
  }

  staffSenderUserId.delete(config)
}

api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  if (
    config.rolvixStaffAuthRetry === true &&
    isBearerAuthorization(authorizationHeader(config))
  ) {
    return config
  }

  const { data } = await supabase.auth.getSession()
  const session = data?.session
  const accessToken = session?.access_token
  if (typeof accessToken === "string" && accessToken.length > 0) {
    rememberStaffSender(config, accessToken, session?.user?.id)
    return config
  }

  staffSenderUserId.delete(config)
  return config
})

api.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!isAxiosError(error) || responseStatus(error) !== 401) {
      return Promise.reject(error)
    }

    const config = error.config
    const hadBearer = isBearerAuthorization(authorizationHeader(config))
    const senderUserId = config ? staffSenderUserId.get(config) : undefined
    if (
      !config ||
      !hadBearer ||
      config.rolvixStaffAuthRetry === true ||
      senderUserId === undefined
    ) {
      logApi401("b2b", config)
      return Promise.reject(error)
    }

    // Refresh the principal that sent this request. Drop the retry if that
    // user signs out or the stored user changes. A terminal GoTrue failure
    // signs out locally so the shell leaves; network and 5xx keep the session.
    const epoch = staffAuthEpoch
    const before = await readStaffSessionPrincipal()
    if (
      !staffPrincipalStill(epoch, senderUserId, before?.userId ?? null) ||
      before === null
    ) {
      logApi401("b2b", config)
      return Promise.reject(error)
    }

    const refresh = await refreshStaffSession(before.refreshToken)
    logApi401("b2b", config, refresh.ok ? undefined : refresh.error)
    const afterUserId = await readStaffUserId()
    if (!staffPrincipalStill(epoch, senderUserId, afterUserId)) {
      return Promise.reject(error)
    }

    if (!refresh.ok) {
      if (isTerminalStaffRefreshError(refresh.error)) {
        try {
          await supabase.auth.signOut({ scope: "local" })
        } catch {
          // Keep rejecting the original 401 if local sign-out fails.
        }
      }
      return Promise.reject(error)
    }

    config.rolvixStaffAuthRetry = true
    setAuthorization(config, refresh.accessToken)
    return api.request(config)
  },
)

customerApi.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const stored = readStoredCustomerToken()
    if (config.rolvixCustomerAuthRetry === true) {
      const bound = bearerToken(authorizationHeader(config))
      if (stored !== null && bound !== null && stored === bound) {
        setAuthorization(config, stored)
        return config
      }

      clearAuthorization(config)
      return config
    }

    if (stored !== null) {
      setAuthorization(config, stored)
    }

    return config
  },
  null,
  { synchronous: true },
)

customerApi.interceptors.response.use(
  (response) => response,
  async (error: unknown): Promise<AxiosResponse> => {
    if (!isAxiosError(error) || responseStatus(error) !== 401) {
      return Promise.reject(error)
    }

    const config = error.config
    const failingBearer = bearerToken(authorizationHeader(config))
    logApi401("b2c", config)

    if (!config || failingBearer === null || typeof window === "undefined") {
      return Promise.reject(error)
    }

    const stored = readStoredCustomerToken()
    if (config.rolvixCustomerAuthRetry === true) {
      if (stored !== null && stored === failingBearer) {
        clearCustomerSessionStorage()
        if (!isCustomerLoginPath(window.location.pathname)) {
          assignBrowserLocation(customerLoginPath())
        }
      } else {
        clearAuthorization(config)
      }
      return Promise.reject(error)
    }

    if (stored === null || stored !== failingBearer) {
      clearAuthorization(config)
      return Promise.reject(error)
    }

    config.rolvixCustomerAuthRetry = true
    return customerApi.request(config)
  },
)
