import type { PackageKey, PlanKey } from "@/features/billing/schemas/billingSchemas"
import { isPackageKey, isPlanKey } from "@/features/billing/schemas/billingSchemas"

/** Same rule the API applies to lead fields: at most 100 chars of [A-Za-z0-9._-]; otherwise dropped. */
const LEAD_VALUE_PATTERN = /^[A-Za-z0-9._-]{1,100}$/
const STORAGE_KEY = "rolvix.leadAttribution"

export type LeadAttribution = {
  leadSource: string | null
  leadCampaign: string | null
}

/** Query params carried from the public pages to the onboarding (campaign tracking). */
export type PassthroughParams = Record<string, string>

export function sanitizeLeadValue(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? ""
  return LEAD_VALUE_PATTERN.test(trimmed) ? trimmed : null
}

function isPassthroughKey(key: string): boolean {
  return key === "ref" || key.startsWith("utm_")
}

/** Picks only `utm_*` and `ref` from a query string. Values are kept raw; they are sanitized when sent. */
export function pickPassthroughParams(search: string): PassthroughParams {
  const result: PassthroughParams = {}
  new URLSearchParams(search).forEach((value, key) => {
    if (isPassthroughKey(key) && value.trim().length > 0) {
      result[key] = value
    }
  })
  return result
}

function readStored(): PassthroughParams {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return {}
    }
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== "object" || parsed === null) {
      return {}
    }
    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, string] =>
          typeof entry[1] === "string" && isPassthroughKey(entry[0]),
      ),
    )
  } catch {
    return {}
  }
}

/**
 * Params in the current URL, falling back to what an earlier public page stored for this tab
 * (a visitor may open `/arenas?utm_source=x` and reach `/onboarding` through plain links).
 */
export function resolvePassthroughParams(search: string): PassthroughParams {
  const fromUrl = pickPassthroughParams(search)
  if (Object.keys(fromUrl).length > 0) {
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(fromUrl))
    } catch {
      // Storage can be unavailable (private mode); the URL params still work.
    }
    return fromUrl
  }
  return readStored()
}

/** `utm_source` -> leadSource, `utm_campaign` -> leadCampaign; `ref` stands in for the source when absent. */
export function toLeadAttribution(params: PassthroughParams): LeadAttribution {
  return {
    leadSource: sanitizeLeadValue(params.utm_source) ?? sanitizeLeadValue(params.ref),
    leadCampaign: sanitizeLeadValue(params.utm_campaign),
  }
}

export function buildOnboardingHref(options: {
  packageKey?: PackageKey | null
  planKey?: PlanKey | null
  passthrough?: PassthroughParams
}): string {
  const query = new URLSearchParams()
  if (options.packageKey) {
    query.set("package", options.packageKey)
  }
  if (options.planKey) {
    query.set("plan", options.planKey)
  }
  for (const [key, value] of Object.entries(options.passthrough ?? {})) {
    query.set(key, value)
  }
  const text = query.toString()
  return text.length > 0 ? `/onboarding?${text}` : "/onboarding"
}

export function readRequestedPackage(search: string): PackageKey | null {
  const value = new URLSearchParams(search).get("package")
  return isPackageKey(value) ? value : null
}

export function readRequestedPlan(search: string): PlanKey | null {
  const value = new URLSearchParams(search).get("plan")
  return isPlanKey(value) ? value : null
}
