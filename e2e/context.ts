import fs from "node:fs"
import path from "node:path"

import {
  AUTH_DIR,
  CACHE_DIR,
  CONTEXT_PATH,
  SNAPSHOT_PATH,
  TOKENS_PATH,
  loadE2eEnv,
} from "./env"

export const COMMERCIAL_MODULES = [
  "inventory",
  "pmoc",
  "os",
  "rentals",
  "catalog",
] as const

export type CommercialModule = (typeof COMMERCIAL_MODULES)[number]

export type TenantSnapshot = {
  id: string
  legalName: string
  taxId: string
  subdomain: string
  logoSvg: string | null
  primaryColor: string | null
  accentColor: string | null
  welcomeTagline: string | null
  commercialModules: string[]
  familyKeys: string[]
  hasLegacyMaintenance: boolean
  menuItems: unknown
  registrationFields: unknown
}

export type E2eContext = {
  runId: string
  tenantId: string
  tenantSlug: string
  isolationTenantId: string | null
  isolationTenantSlug: string | null
  isolationCreatedThisRun: boolean
}

export type TokenBundle = {
  platformAdmin: string
  b2b: string
  customer: string
}

export function commercialPowerSet(): string[][] {
  const sets: string[][] = []
  const n = COMMERCIAL_MODULES.length
  for (let mask = 0; mask < 1 << n; mask += 1) {
    sets.push(COMMERCIAL_MODULES.filter((_, index) => ((mask >> index) & 1) === 1))
  }
  return sets
}

export function canonicalModules(modules: readonly unknown[]): string[] {
  return modules
    .map((entry) => {
      if (typeof entry === "string") {
        return entry.trim().toLowerCase()
      }
      if (entry && typeof entry === "object" && "moduleName" in entry) {
        const record = entry as { moduleName?: unknown; isActive?: unknown }
        if (record.isActive === false) {
          return ""
        }
        return String(record.moduleName ?? "")
          .trim()
          .toLowerCase()
      }
      return ""
    })
    .filter((key) => key.length > 0)
}

export function commercialOnly(modules: readonly string[]): string[] {
  const allowed = new Set<string>(COMMERCIAL_MODULES)
  return [...new Set(modules.filter((key) => allowed.has(key)))]
}

export function ensureAuthDirs(): void {
  fs.mkdirSync(AUTH_DIR, { recursive: true })
  fs.mkdirSync(CACHE_DIR, { recursive: true })
}

export function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8")
}

export function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T
}

export function readContext(): E2eContext {
  return readJson<E2eContext>(CONTEXT_PATH)
}

export function readSnapshot(): TenantSnapshot {
  return readJson<TenantSnapshot>(SNAPSHOT_PATH)
}

export function readTokens(): TokenBundle {
  return readJson<TokenBundle>(TOKENS_PATH)
}

export function extractSupabaseAccessToken(storageStatePath: string): string {
  const state = readJson<{
    origins?: Array<{
      localStorage?: Array<{ name: string; value: string }>
    }>
  }>(storageStatePath)

  for (const origin of state.origins ?? []) {
    for (const item of origin.localStorage ?? []) {
      if (!item.name.includes("auth-token")) {
        continue
      }
      try {
        const parsed = JSON.parse(item.value) as { access_token?: string }
        if (typeof parsed.access_token === "string" && parsed.access_token.length > 0) {
          return parsed.access_token
        }
      } catch {
        continue
      }
    }
  }

  throw new Error("E2E_CONFIG_REQUIRED: could not extract B2B access token from storage state")
}

export function extractCustomerAccessToken(storageStatePath: string): string {
  const state = readJson<{
    origins?: Array<{
      localStorage?: Array<{ name: string; value: string }>
    }>
  }>(storageStatePath)

  for (const origin of state.origins ?? []) {
    for (const item of origin.localStorage ?? []) {
      if (item.name === "rolvix.customer.token" && item.value.trim().length > 0) {
        return item.value
      }
    }
  }

  throw new Error("E2E_CONFIG_REQUIRED: could not extract Customer token from storage state")
}

export function loadEnvForTests(): ReturnType<typeof loadE2eEnv> {
  return loadE2eEnv()
}

export { CONTEXT_PATH, SNAPSHOT_PATH, TOKENS_PATH }
