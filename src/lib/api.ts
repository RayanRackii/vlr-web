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
import {
  noteTransportFailure,
  noteTransportSuccess,
} from "@/lib/connectivity"
import { supabase } from "@/lib/supabase"
import i18n from "@/lib/i18n"
import { isModuleInactiveValue } from "@/lib/apiErrorText"
import { safeStaffNextPath, staffLoginPath } from "@/lib/safeStaffNextPath"
import { noteSignInStarted } from "@/lib/signOutMarker"

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
/** Must match `CUSTOMER_TENANT_ID_KEY` in tenantPortalService. */
const CUSTOMER_TENANT_ID_STORAGE_KEY = "rolvix.customer.tenantId"

const apiErrorSchema = z.object({
  error: z.string(),
})

type StaffRefreshResult =
  | { kind: "refreshed"; accessToken: string }
  | { kind: "skipped" }
  | { kind: "failed"; error: unknown }

type StaffSessionSnapshot = {
  tenantId: string | null
  userId: string
  refreshToken: string
  accessToken: string
}

type StaffRefreshBinding = {
  epoch: number
  userId: string
  refreshToken: string
}

type StaffSignOut = typeof supabase.auth.signOut

/**
 * Bumped synchronously at the start of staff `signOut` and password sign-in.
 * A 401 retry still awaiting refresh must not call `refreshSession` or sign
 * out locally after this changes.
 */
let staffAuthEpoch = 0
let staffSignOutEpochInstalled = false
let staffRefreshInflight: Promise<StaffRefreshResult> | null = null
let staffRefreshInflightToken: string | null = null
let staffSessionExpiryHandled = false
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

function noteTransportFromSettled(error: unknown): void {
  // An intentional cancellation says nothing about current reachability. In
  // particular an old offline PATCH must not relatch a recovered connection.
  if (axios.isCancel(error)) return

  if (isAxiosError(error) && error.response) {
    noteTransportSuccess()
    return
  }

  noteTransportFailure()
}

/** AllowAnonymous portal/onboarding calls. Never attaches Authorization. */
export const publicApi = createApiClient()

publicApi.interceptors.response.use(
  (response) => {
    noteTransportSuccess()
    return response
  },
  (error: unknown) => {
    noteTransportFromSettled(error)
    return Promise.reject(error)
  },
)

/** B2B panel: Supabase session JWT only. */
export const api = createApiClient()

/** B2C tenant portal: Customer JWT only (localStorage). */
export const customerApi = createApiClient()

export { isModuleInactiveValue }

export function parseApiError(payload: unknown, fallbackMessage: string): string {
  if (isModuleInactivePayload(payload)) {
    return i18n.t("apiErrors.moduleInactive")
  }

  const parsed = apiErrorSchema.safeParse(payload)

  if (parsed.success) {
    return parsed.data.error
  }

  return fallbackMessage
}

function isModuleInactivePayload(payload: unknown): boolean {
  if (typeof payload !== "object" || payload === null) return false
  const record = payload as Record<string, unknown>
  return [record.error, record.code, record.errorCode].some(isModuleInactiveValue)
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
  staffSessionExpiryHandled = false
}

/**
 * Call synchronously before `signInWithPassword`.
 * A failed attempt bumps the epoch too and does not sign the current user out.
 */
export function noteStaffSignIn(): void {
  noteSignInStarted()
  staffAuthEpoch += 1
  // Sair stops auto-refresh; a new login on the same page turns it back on.
  try {
    void supabase.auth.startAutoRefresh()?.catch?.(() => undefined)
  } catch {
    // Test double without startAutoRefresh.
  }
}

/** Tests only. */
export function staffAuthEpochForTests(): number {
  return staffAuthEpoch
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

async function readStaffSession(): Promise<StaffSessionSnapshot | null> {
  try {
    const { data } = await supabase.auth.getSession()
    const session = data?.session
    const userId = session?.user?.id
    const refreshToken = session?.refresh_token
    const accessToken = session?.access_token
    if (typeof userId !== "string" || userId.length === 0) {
      return null
    }
    if (typeof refreshToken !== "string" || refreshToken.length === 0) {
      return null
    }
    if (typeof accessToken !== "string" || accessToken.length === 0) {
      return null
    }
    const tenantId: unknown = session?.user?.app_metadata?.tenant_id
    return { userId, refreshToken, accessToken, tenantId: typeof tenantId === "string" ? tenantId : null }
  } catch {
    return null
  }
}

function staffBindingMatches(
  binding: StaffRefreshBinding,
  current: StaffSessionSnapshot | null,
): boolean {
  return (
    staffAuthEpoch === binding.epoch &&
    current !== null &&
    current.userId === binding.userId &&
    current.refreshToken === binding.refreshToken
  )
}

async function performStaffRefresh(): Promise<StaffRefreshResult> {
  try {
    // GoTrue owns refresh-token rotation. Passing a snapshot races its
    // auto-refresh and can exchange the same rotated token twice.
    const result = await supabase.auth.refreshSession()
    if (result.error) {
      return { kind: "failed", error: result.error }
    }

    const accessToken = result.data?.session?.access_token
    if (typeof accessToken !== "string" || accessToken.trim().length === 0) {
      return { kind: "failed", error: null }
    }

    return { kind: "refreshed", accessToken }
  } catch (error: unknown) {
    return { kind: "failed", error }
  }
}

async function refreshStaffSessionAfterWait(
  binding: StaffRefreshBinding,
): Promise<StaffRefreshResult> {
  const current = await readStaffSession()
  if (!staffBindingMatches(binding, current)) {
    return { kind: "skipped" }
  }

  return refreshStaffSession(binding)
}

function refreshStaffSession(
  binding: StaffRefreshBinding,
): Promise<StaffRefreshResult> {
  if (
    staffRefreshInflight &&
    staffRefreshInflightToken === binding.refreshToken
  ) {
    return staffRefreshInflight
  }

  if (staffRefreshInflight) {
    return staffRefreshInflight.then(
      () => refreshStaffSessionAfterWait(binding),
      () => refreshStaffSessionAfterWait(binding),
    )
  }

  staffRefreshInflightToken = binding.refreshToken
  const promise = performStaffRefresh().finally(() => {
    if (staffRefreshInflight === promise) {
      staffRefreshInflight = null
      staffRefreshInflightToken = null
    }
  })
  staffRefreshInflight = promise
  return promise
}

function redirectExpiredStaffSession(tenantId: string | null): void {
  if (staffSessionExpiryHandled || typeof window === "undefined") {
    return
  }

  staffSessionExpiryHandled = true
  const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`
  const nextPath = safeStaffNextPath(currentPath)
  const params = { reason: "session-expired", tenant: tenantId, company: new URLSearchParams(window.location.search).get("company") }
  assignBrowserLocation(staffLoginPath(nextPath ?? "/dashboard", params))
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
  window.localStorage.removeItem(CUSTOMER_TENANT_ID_STORAGE_KEY)
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
  (response) => {
    noteTransportSuccess()
    return response
  },
  async (error: unknown) => {
    noteTransportFromSettled(error)

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

    // Capture the session that sent this request. After every wait, refresh
    // only if the epoch, user id, and stored refresh token still match.
    // Otherwise retry with the current access token or reject, without
    // calling refreshSession. A terminal GoTrue failure signs out locally
    // only when that same refresh token is still stored.
    const epoch = staffAuthEpoch
    const before = await readStaffSession()
    const binding: StaffRefreshBinding = {
      epoch,
      userId: senderUserId,
      refreshToken: before?.refreshToken ?? "",
    }
    if (!staffBindingMatches(binding, before)) {
      logApi401("b2b", config)
      return Promise.reject(error)
    }

    const refresh = await refreshStaffSession(binding)
    return settleStaff401(config, error, binding, refresh)
  },
)

async function settleStaff401(
  config: InternalAxiosRequestConfig,
  error: AxiosError,
  binding: StaffRefreshBinding,
  refresh: StaffRefreshResult,
): Promise<AxiosResponse> {
  logApi401(
    "b2b",
    config,
    refresh.kind === "failed" ? refresh.error : undefined,
  )

  const current = await readStaffSession()
  if (
    current === null ||
    current.userId !== binding.userId ||
    staffAuthEpoch !== binding.epoch
  ) {
    return Promise.reject(error)
  }

  if (current.refreshToken !== binding.refreshToken) {
    config.rolvixStaffAuthRetry = true
    setAuthorization(config, current.accessToken)
    return api.request(config)
  }

  if (refresh.kind === "failed") {
    if (isTerminalStaffRefreshError(refresh.error)) {
      // A concurrent GoTrue refresh may have rotated storage while ours was
      // failing. Never discard that newer session.
      const latest = await readStaffSession()
      if (
        latest === null ||
        latest.userId !== binding.userId ||
        staffAuthEpoch !== binding.epoch
      ) {
        return Promise.reject(error)
      }
      if (
        (latest.refreshToken !== binding.refreshToken ||
          latest.accessToken !== current.accessToken)
      ) {
        config.rolvixStaffAuthRetry = true
        setAuthorization(config, latest.accessToken)
        return api.request(config)
      }
      try {
        await supabase.auth.signOut({ scope: "local" })
      } catch {
        // Keep rejecting the original 401 if local sign-out fails.
      }
      redirectExpiredStaffSession(latest.tenantId)
    }
    return Promise.reject(error)
  }

  if (refresh.kind !== "refreshed") {
    return Promise.reject(error)
  }

  config.rolvixStaffAuthRetry = true
  setAuthorization(config, refresh.accessToken)
  return api.request(config)
}

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
  (response) => {
    noteTransportSuccess()
    return response
  },
  async (error: unknown): Promise<AxiosResponse> => {
    noteTransportFromSettled(error)

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
