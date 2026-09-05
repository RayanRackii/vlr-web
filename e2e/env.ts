import { config as loadDotenv } from "dotenv"
import fs from "node:fs"
import path from "node:path"

const REQUIRED_WEB = "https://vlr-web-git-develop-vlr-solutions.vercel.app"
const REQUIRED_API = "https://vlr-api-development.up.railway.app"

const PROD_HOST_MARKERS = [
  "rolvix.com.br",
  "www.rolvix.com.br",
  "vlr-api-production",
  "railway.app/production",
]

export type E2eEnv = {
  envName: "development"
  webUrl: string
  apiUrl: string
  platformAdminEmail: string
  platformAdminPassword: string
  b2bEmail: string
  b2bPassword: string
  customerEmail: string
  customerPassword: string
  targetTenantId: string | null
  targetTenantSlug: string | null
  allowMutations: boolean
  restoreOriginalTenantState: boolean
}

let cached: E2eEnv | null = null

function normalizeUrl(value: string): string {
  return value.trim().replace(/\/$/, "")
}

function isProductionTarget(value: string): boolean {
  const lower = value.toLowerCase()
  return PROD_HOST_MARKERS.some((marker) => lower.includes(marker))
}

function required(name: string, value: string | undefined): string {
  const trimmed = value?.trim() ?? ""
  if (trimmed.length === 0) {
    throw new Error(`E2E_CONFIG_REQUIRED: missing ${name}`)
  }
  return trimmed
}

export function loadE2eEnv(): E2eEnv {
  if (cached) {
    return cached
  }

  const envPath = path.resolve(process.cwd(), ".env.e2e.local")
  if (!fs.existsSync(envPath)) {
    throw new Error("E2E_CONFIG_REQUIRED: .env.e2e.local is missing")
  }

  loadDotenv({ path: envPath, override: false })

  const envName = required("E2E_ENV", process.env.E2E_ENV)
  const webUrl = normalizeUrl(required("E2E_WEB_URL", process.env.E2E_WEB_URL))
  const apiUrl = normalizeUrl(required("E2E_API_URL", process.env.E2E_API_URL))

  if (envName !== "development") {
    throw new Error("E2E_PROD_GUARD_BLOCKED: E2E_ENV must equal development")
  }

  if (webUrl !== REQUIRED_WEB) {
    throw new Error("E2E_PROD_GUARD_BLOCKED: E2E_WEB_URL is not the DEV Preview")
  }

  if (apiUrl !== REQUIRED_API) {
    throw new Error("E2E_PROD_GUARD_BLOCKED: E2E_API_URL is not the Railway DEV API")
  }

  if (isProductionTarget(webUrl) || isProductionTarget(apiUrl)) {
    throw new Error("E2E_PROD_GUARD_BLOCKED: production infrastructure detected")
  }

  for (const [key, value] of Object.entries(process.env)) {
    if (!value) {
      continue
    }
    const upper = key.toUpperCase()
    if (
      !upper.includes("SUPABASE") &&
      !upper.startsWith("E2E_") &&
      !upper.startsWith("VITE_")
    ) {
      continue
    }
    if (isProductionTarget(value)) {
      throw new Error("E2E_PROD_GUARD_BLOCKED: production infrastructure detected")
    }
  }

  cached = {
    envName,
    webUrl,
    apiUrl,
    platformAdminEmail: required(
      "E2E_PLATFORM_ADMIN_EMAIL",
      process.env.E2E_PLATFORM_ADMIN_EMAIL,
    ),
    platformAdminPassword: required(
      "E2E_PLATFORM_ADMIN_PASSWORD",
      process.env.E2E_PLATFORM_ADMIN_PASSWORD,
    ),
    b2bEmail: required("E2E_B2B_EMAIL", process.env.E2E_B2B_EMAIL),
    b2bPassword: required("E2E_B2B_PASSWORD", process.env.E2E_B2B_PASSWORD),
    customerEmail: required("E2E_CUSTOMER_EMAIL", process.env.E2E_CUSTOMER_EMAIL),
    customerPassword: required(
      "E2E_CUSTOMER_PASSWORD",
      process.env.E2E_CUSTOMER_PASSWORD,
    ),
    targetTenantId: process.env.E2E_TARGET_TENANT_ID?.trim() || null,
    targetTenantSlug: process.env.E2E_TARGET_TENANT_SLUG?.trim() || null,
    allowMutations: process.env.E2E_ALLOW_MUTATIONS !== "false",
    restoreOriginalTenantState:
      process.env.E2E_RESTORE_ORIGINAL_TENANT_STATE !== "false",
  }

  return cached
}

export const AUTH_DIR = path.resolve(process.cwd(), "e2e/.auth")
export const CACHE_DIR = path.resolve(process.cwd(), "e2e/.cache")
export const CONTEXT_PATH = path.join(AUTH_DIR, "context.json")
export const SNAPSHOT_PATH = path.join(CACHE_DIR, "tenant-snapshot.json")
export const PLATFORM_ADMIN_STATE = path.join(AUTH_DIR, "platform-admin.json")
export const B2B_STATE = path.join(AUTH_DIR, "b2b.json")
export const B2C_STATE = path.join(AUTH_DIR, "b2c.json")
export const TOKENS_PATH = path.join(AUTH_DIR, "tokens.json")
