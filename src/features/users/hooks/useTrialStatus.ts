import { useEffect, useState } from "react"

import { getCurrentUser } from "@/features/users/services/usersService"
import type { CurrentUser } from "@/features/users/schemas/userSchemas"

export type TrialStatus = {
  isLoading: boolean
  isTrial: boolean
  isTrialReadOnly: boolean
  trialEndsAt: string | null | undefined
  trialPurgeAt: string | null | undefined
}

const idle: TrialStatus = {
  isLoading: true,
  isTrial: false,
  isTrialReadOnly: false,
  trialEndsAt: undefined,
  trialPurgeAt: undefined,
}

function fromProfile(profile: CurrentUser | null): TrialStatus {
  if (!profile) {
    return {
      isLoading: false,
      isTrial: false,
      isTrialReadOnly: false,
      trialEndsAt: undefined,
      trialPurgeAt: undefined,
    }
  }

  return {
    isLoading: false,
    isTrial: profile.isTrial,
    isTrialReadOnly: profile.isTrialReadOnly,
    trialEndsAt: profile.trialEndsAt,
    trialPurgeAt: profile.trialPurgeAt,
  }
}

/** Loads `/users/me` trial flags for disabling writes in the B2B shell. */
export function useTrialStatus(): TrialStatus {
  const [status, setStatus] = useState<TrialStatus>(idle)

  useEffect(() => {
    let cancelled = false
    void getCurrentUser()
      .then((user) => {
        if (!cancelled) {
          setStatus(fromProfile(user))
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStatus(fromProfile(null))
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  return status
}
