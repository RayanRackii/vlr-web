import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import { getCurrentUser } from "@/features/users/services/usersService"
import type { CurrentUser } from "@/features/users/schemas/userSchemas"

function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) {
    return null
  }
  const target = new Date(iso).getTime()
  if (Number.isNaN(target)) {
    return null
  }
  const diff = target - Date.now()
  return Math.max(0, Math.ceil(diff / (24 * 60 * 60 * 1000)))
}

export function TrialBanner() {
  const { t } = useTranslation()
  const [profile, setProfile] = useState<CurrentUser | null>(null)

  useEffect(() => {
    let cancelled = false
    void getCurrentUser()
      .then((user) => {
        if (!cancelled) {
          setProfile(user)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setProfile(null)
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (!profile?.isTrial) {
    return null
  }

  if (profile.isTrialReadOnly) {
    const purgeDays = daysUntil(profile.trialPurgeAt)
    return (
      <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-950 dark:text-amber-100">
        {t("trial.banner.readOnly", {
          days: purgeDays ?? "—",
        })}
      </div>
    )
  }

  const remaining = daysUntil(profile.trialEndsAt)
  return (
    <div className="border-b border-primary/20 bg-primary/5 px-4 py-2 text-sm text-foreground">
      {t("trial.banner.active", {
        days: remaining ?? "—",
      })}
    </div>
  )
}
