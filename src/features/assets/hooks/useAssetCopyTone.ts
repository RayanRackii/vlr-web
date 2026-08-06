import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import { getCurrentUser } from "@/features/users/services/usersService"

export type AssetCopyTone = "rentals" | "maintenance" | "generic"

const MAINTENANCE_MODULES = new Set([
  "pmoc",
  "os",
  "maintenance",
  "inventory",
])

export function resolveAssetCopyTone(
  modules: readonly string[],
): AssetCopyTone {
  const normalized = modules.map((module) => module.trim().toLowerCase())

  if (normalized.includes("rentals")) {
    return "rentals"
  }

  if (normalized.some((module) => MAINTENANCE_MODULES.has(module))) {
    return "maintenance"
  }

  return "generic"
}

/**
 * Copy tone for Assets UI based on tenant activeModules.
 * `tone` is null while the profile is still loading.
 */
export function useAssetCopyTone() {
  const { t, i18n } = useTranslation()
  const [modules, setModules] = useState<string[] | null>(null)

  useEffect(() => {
    let cancelled = false

    void getCurrentUser()
      .then((profile) => {
        if (!cancelled) {
          setModules(profile.activeModules ?? [])
        }
      })
      .catch(() => {
        if (!cancelled) {
          setModules([])
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  const tone = useMemo(
    () => (modules === null ? null : resolveAssetCopyTone(modules)),
    [modules],
  )

  function tTone(baseKey: string): string {
    const effectiveTone = tone ?? "generic"
    const keyed = `${baseKey}.${effectiveTone}`
    if (i18n.exists(keyed)) {
      return t(keyed)
    }
    return t(`${baseKey}.generic`)
  }

  return {
    tone,
    isToneLoading: modules === null,
    tTone,
  }
}
