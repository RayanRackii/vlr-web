import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import { getCurrentUser } from "@/features/users/services/usersService"

export type AssetCopyTone =
  | "spaces"
  | "goods"
  | "electrical"
  | "rentals"
  | "maintenance"
  | "generic"

const MAINTENANCE_MODULES = new Set([
  "pmoc",
  "os",
  "maintenance",
  "inventory",
])

/**
 * Prefer tenant asset families for copy; fall back to activeModules.
 */
export function resolveAssetCopyTone(
  families: readonly string[],
  modules: readonly string[] = [],
): AssetCopyTone {
  const normalizedFamilies = families.map((f) => f.trim().toLowerCase())
  const familySet = new Set(normalizedFamilies)

  const nonGeneric = normalizedFamilies.filter((f) => f !== "generic")
  if (nonGeneric.length === 1) {
    const only = nonGeneric[0]
    if (only === "spaces" || only === "goods" || only === "electrical") {
      return only
    }
  }

  if (nonGeneric.length > 1) {
    if (familySet.has("spaces") && !familySet.has("goods") && !familySet.has("electrical")) {
      return "spaces"
    }
    if (familySet.has("goods") && !familySet.has("spaces") && !familySet.has("electrical")) {
      return "goods"
    }
    if (familySet.has("electrical") && !familySet.has("spaces") && !familySet.has("goods")) {
      return "electrical"
    }
  }

  const normalizedModules = modules.map((module) => module.trim().toLowerCase())

  if (normalizedModules.includes("rentals") || familySet.has("spaces") || familySet.has("goods")) {
    return "rentals"
  }

  if (normalizedModules.some((module) => MAINTENANCE_MODULES.has(module))) {
    return "maintenance"
  }

  return "generic"
}

/**
 * Copy tone for Assets UI based on tenant asset families (preferred) and modules.
 * `tone` is null while the profile is still loading.
 */
export function useAssetCopyTone() {
  const { t, i18n } = useTranslation()
  const [profile, setProfile] = useState<{
    modules: string[]
    families: string[]
  } | null>(null)

  useEffect(() => {
    let cancelled = false

    void getCurrentUser()
      .then((user) => {
        if (!cancelled) {
          setProfile({
            modules: user.activeModules ?? [],
            families: user.activeAssetFamilies ?? [],
          })
        }
      })
      .catch(() => {
        if (!cancelled) {
          setProfile({ modules: [], families: [] })
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  const tone = useMemo(
    () =>
      profile === null
        ? null
        : resolveAssetCopyTone(profile.families, profile.modules),
    [profile],
  )

  function tTone(baseKey: string): string {
    const effectiveTone = tone ?? "generic"
    const keyed = `${baseKey}.${effectiveTone}`
    if (i18n.exists(keyed)) {
      return t(keyed)
    }
    // Fallbacks when family-specific copy is missing
    if (effectiveTone === "spaces" && i18n.exists(`${baseKey}.rentals`)) {
      return t(`${baseKey}.rentals`)
    }
    if (effectiveTone === "goods" && i18n.exists(`${baseKey}.rentals`)) {
      return t(`${baseKey}.rentals`)
    }
    if (effectiveTone === "electrical" && i18n.exists(`${baseKey}.maintenance`)) {
      return t(`${baseKey}.maintenance`)
    }
    return t(`${baseKey}.generic`)
  }

  return {
    tone,
    isToneLoading: profile === null,
    tTone,
  }
}
