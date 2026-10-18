import {
  clearPlatformTenantExited,
  writeActiveTenantLabel,
} from "@/features/admin/hooks/usePlatformTenantSession"
import {
  clearAgendaQueryClient,
  getAgendaSessionGeneration,
} from "@/features/tenantPortal/lib/agendaQueryClient"
import {
  clearCustomerSession,
  getCustomerAccessToken,
  getHostTenantSubdomain,
  isCustomerSignedInForTenant,
  tenantPortalPath,
  tenantPortalPathMode,
} from "@/features/tenantPortal/services/tenantPortalService"
import { invalidateCurrentUserCache } from "@/features/users/services/currentUserCache"
import { replaceBrowserLocation } from "@/lib/browserLocation"
import appI18n from "@/lib/i18n"
import { supabase } from "@/lib/supabase"
import { persistLanguage } from "@/lib/uiLanguage"

const CUSTOMER_ROOTS = ["app", "agenda", "catalogo", "pedidos"] as const

const STAFF_PREFIXES = [
  "/dashboard",
  "/ativos",
  "/pmoc",
  "/os",
  "/configuracoes",
  "/catalogo",
  "/pessoas-e-acesso",
  "/perfil",
  "/admin",
] as const

const STAFF_STORAGE_KEY = /^sb-.+-auth-token$/

export type AuthenticatedSurface = "staff" | "customer"

let installed = false
let restoreBlocked = false
let signedOutStaffAccessToken: string | null = null
let hiddenSession: {
  token: string | null
  generation: number
} | null = null

function normalizePath(pathname: string): string {
  const path = pathname.split("?")[0]?.split("#")[0] ?? pathname
  if (path.length > 1 && path.endsWith("/")) {
    return path.slice(0, -1)
  }
  return path
}

function matchesPrefix(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`)
}

function customerRoot(path: string): string {
  return path.split("/").filter(Boolean)[0] ?? ""
}

export function authenticatedSurface(
  pathname: string,
  hostSubdomain: string | null = getHostTenantSubdomain(),
): AuthenticatedSurface | null {
  const path = normalizePath(pathname)

  if (hostSubdomain) {
    const segment = customerRoot(path)
    return (CUSTOMER_ROOTS as readonly string[]).includes(segment)
      ? "customer"
      : null
  }

  const tenant = /^\/t\/([a-z0-9-]+)(?:\/(.*))?$/i.exec(path)
  if (tenant) {
    const segment = customerRoot(tenant[2] ?? "")
    return (CUSTOMER_ROOTS as readonly string[]).includes(segment)
      ? "customer"
      : null
  }

  if (STAFF_PREFIXES.some((prefix) => matchesPrefix(path, prefix))) {
    return "staff"
  }

  return null
}

export function loginPathForAuthenticatedPath(
  pathname: string,
  hostSubdomain: string | null = getHostTenantSubdomain(),
): string | null {
  const surface = authenticatedSurface(pathname, hostSubdomain)
  if (surface === "staff") {
    return "/login"
  }
  if (surface !== "customer") {
    return null
  }
  if (hostSubdomain) {
    return "/"
  }

  const slug = /^\/t\/([a-z0-9-]+)/i.exec(normalizePath(pathname))?.[1]?.toLowerCase()
  if (!slug) {
    return "/"
  }
  return tenantPortalPathMode(slug)
}

function accessTokenFromStoredSession(value: unknown): string | null {
  if (typeof value !== "object" || value === null) {
    return null
  }

  const record = value as Record<string, unknown>
  if (
    typeof record.access_token !== "string" ||
    record.access_token.length === 0 ||
    typeof record.refresh_token !== "string" ||
    record.refresh_token.length === 0 ||
    typeof record.expires_at !== "number"
  ) {
    return null
  }

  return record.access_token
}

function readStaffAccessToken(): string | null {
  try {
    const storage = window.localStorage
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index)
      if (!key || !STAFF_STORAGE_KEY.test(key)) {
        continue
      }
      const raw = storage.getItem(key)
      if (!raw) {
        continue
      }
      const token = accessTokenFromStoredSession(JSON.parse(raw) as unknown)
      if (token) {
        return token
      }
    }
  } catch {
    return null
  }

  return null
}

function staffSessionIsActive(): boolean {
  const token = readStaffAccessToken()
  if (token === null) {
    return false
  }
  return token !== signedOutStaffAccessToken
}

function customerSlug(
  pathname: string,
  hostSubdomain: string | null,
): string | null {
  if (hostSubdomain) {
    return hostSubdomain
  }
  return /^\/t\/([a-z0-9-]+)/i.exec(normalizePath(pathname))?.[1]?.toLowerCase() ?? null
}

function sessionStillActive(pathname: string, hostSubdomain: string | null): boolean {
  const surface = authenticatedSurface(pathname, hostSubdomain)
  if (surface === "staff") {
    return staffSessionIsActive()
  }
  if (surface === "customer") {
    const slug = customerSlug(pathname, hostSubdomain)
    return slug !== null && isCustomerSignedInForTenant(slug)
  }
  return true
}

function sessionAccessToken(surface: AuthenticatedSurface): string | null {
  return surface === "staff" ? readStaffAccessToken() : getCustomerAccessToken()
}

export function isAuthenticatedRestoreBlocked(): boolean {
  return restoreBlocked
}

export function clearAuthenticatedQueryCaches(): void {
  invalidateCurrentUserCache()
  clearAgendaQueryClient()
}

function concealAuthenticatedShell(): void {
  document.getElementById("root")?.replaceChildren()
}

function blockAndLeave(pathname: string, hostSubdomain: string | null): void {
  const target = loginPathForAuthenticatedPath(pathname, hostSubdomain)
  if (!target) {
    return
  }

  blockAndReplace(target)
}

function blockAndReplace(target: string): void {
  restoreBlocked = true
  concealAuthenticatedShell()
  replaceBrowserLocation(target)
}

function isPersistedPageShow(event: Event): boolean {
  return "persisted" in event && event.persisted === true
}

function onPageShow(event: Event): void {
  if (!isPersistedPageShow(event)) {
    return
  }

  const pathname = window.location.pathname
  const hostSubdomain = getHostTenantSubdomain()
  const surface = authenticatedSurface(pathname, hostSubdomain)
  if (surface === null) {
    return
  }
  if (sessionStillActive(pathname, hostSubdomain)) {
    if (
      hiddenSession !== null &&
      (hiddenSession.token !== sessionAccessToken(surface) ||
        hiddenSession.generation !== getAgendaSessionGeneration())
    ) {
      clearAuthenticatedQueryCaches()
      blockAndReplace(`${pathname}${window.location.search}${window.location.hash}`)
      event.stopImmediatePropagation()
    }
    return
  }

  clearAuthenticatedQueryCaches()
  blockAndLeave(pathname, hostSubdomain)
  event.stopImmediatePropagation()
}

function onPopState(event: Event): void {
  const pathname = window.location.pathname
  const hostSubdomain = getHostTenantSubdomain()
  if (authenticatedSurface(pathname, hostSubdomain) === null) {
    return
  }
  if (sessionStillActive(pathname, hostSubdomain)) {
    return
  }

  blockAndLeave(pathname, hostSubdomain)
  event.stopImmediatePropagation()
}

function onPageHide(): void {
  const pathname = window.location.pathname
  const hostSubdomain = getHostTenantSubdomain()
  const surface = authenticatedSurface(pathname, hostSubdomain)
  if (surface === null) {
    hiddenSession = null
    return
  }
  hiddenSession = {
    token: sessionAccessToken(surface),
    generation: getAgendaSessionGeneration(),
  }
  if (sessionStillActive(pathname, hostSubdomain)) {
    return
  }

  concealAuthenticatedShell()
}

/** Capture-phase listeners survive a frozen document and run before router updates. */
export function installSessionRestoreGuard(): void {
  if (installed || typeof window === "undefined") {
    return
  }

  installed = true
  window.addEventListener("pageshow", onPageShow, true)
  window.addEventListener("popstate", onPopState, true)
  window.addEventListener("pagehide", onPageHide, true)
}

export function resetSessionRestoreGuardForTests(): void {
  window.removeEventListener("pageshow", onPageShow, true)
  window.removeEventListener("popstate", onPopState, true)
  window.removeEventListener("pagehide", onPageHide, true)
  installed = false
  restoreBlocked = false
  signedOutStaffAccessToken = null
  hiddenSession = null
}

function rememberStaffSignOut(): void {
  signedOutStaffAccessToken = readStaffAccessToken()
}

function cancelStaffSignOut(): void {
  signedOutStaffAccessToken = null
}

function keepChosenLanguage(): void {
  persistLanguage(appI18n.resolvedLanguage ?? appI18n.language)
}

export async function signOutStaffPortal(): Promise<boolean> {
  rememberStaffSignOut()
  writeActiveTenantLabel(null)
  clearAuthenticatedQueryCaches()
  const { error } = await supabase.auth.signOut()
  keepChosenLanguage()
  if (error !== null) {
    cancelStaffSignOut()
    return false
  }

  clearPlatformTenantExited()
  return true
}

export function signOutCustomerPortal(subdomain: string): string {
  clearCustomerSession()
  clearAuthenticatedQueryCaches()
  keepChosenLanguage()
  return tenantPortalPath(subdomain)
}
