import { useEffect, useMemo, useState } from "react"

import { useAuth } from "@/contexts/AuthContext"
import type { ApplicationRole } from "@/features/users/schemas/userSchemas"
import { getCurrentUser } from "@/features/users/services/usersService"

export type ResolveIsPlatformAdminInput = {
  role: string | null | undefined
  tenantId?: string | null
  email: string | null | undefined
  allowlistEmails: readonly string[]
  meFailed?: boolean
}

export function parsePlatformAdminEmails(
  raw: string | undefined = import.meta.env.VITE_PLATFORM_ADMIN_EMAILS,
): string[] {
  if (typeof raw !== "string" || raw.trim().length === 0) {
    return []
  }

  return raw
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter((email) => email.length > 0)
}

function isEmailOnAllowlist(
  email: string | null | undefined,
  allowlistEmails: readonly string[],
): boolean {
  const normalizedEmail = email?.trim().toLowerCase() ?? ""

  if (normalizedEmail.length === 0) {
    return false
  }

  return allowlistEmails.some(
    (item) => item.trim().toLowerCase() === normalizedEmail,
  )
}

/**
 * Platform-admin decision table (pure): SUPER_ADMIN from /me, else email allowlist.
 * `tenantId` is part of the public contract (enter-tenant still uses the allowlist).
 */
export function resolveIsPlatformAdmin({
  role,
  email,
  allowlistEmails,
  meFailed = false,
}: ResolveIsPlatformAdminInput): boolean {
  const emailOnAllowlist = isEmailOnAllowlist(email, allowlistEmails)
  const effectiveRole = meFailed ? undefined : role

  if (effectiveRole === "SUPER_ADMIN") {
    return true
  }

  return emailOnAllowlist
}

export type PlatformAdminState = {
  isPlatformAdmin: boolean
  isResolving: boolean
}

export function usePlatformAdminState(): PlatformAdminState {
  const { user, isLoading: isAuthLoading } = useAuth()
  const [role, setRole] = useState<ApplicationRole | null>(null)
  const [tenantId, setTenantId] = useState<string | null>(null)
  const [meStatus, setMeStatus] = useState<"idle" | "loading" | "success" | "error">(
    "idle",
  )

  const allowlistEmails = parsePlatformAdminEmails()
  const email = user?.email ?? null
  const emailOnAllowlist = isEmailOnAllowlist(email, allowlistEmails)

  useEffect(() => {
    if (!user) {
      setRole(null)
      setTenantId(null)
      setMeStatus("idle")
      return
    }

    let cancelled = false
    setMeStatus("loading")

    void getCurrentUser()
      .then((profile) => {
        if (cancelled) {
          return
        }

        setRole(profile.role)
        setTenantId(profile.tenantId ?? null)
        setMeStatus("success")
      })
      .catch(() => {
        if (cancelled) {
          return
        }

        setRole(null)
        setTenantId(null)
        setMeStatus("error")
      })

    return () => {
      cancelled = true
    }
  }, [user])

  return useMemo(() => {
    if (!user) {
      return { isPlatformAdmin: false, isResolving: isAuthLoading }
    }

    const meFailed = meStatus === "error"
    const isPlatformAdmin = resolveIsPlatformAdmin({
      role,
      tenantId,
      email,
      allowlistEmails,
      meFailed,
    })

    const waitingForMe =
      meStatus === "idle" || meStatus === "loading"
    const isResolving =
      isAuthLoading || (waitingForMe && !emailOnAllowlist)

    if (waitingForMe && emailOnAllowlist) {
      return { isPlatformAdmin: true, isResolving: false }
    }

    return { isPlatformAdmin, isResolving }
  }, [
    allowlistEmails,
    email,
    emailOnAllowlist,
    isAuthLoading,
    meStatus,
    role,
    tenantId,
    user,
  ])
}

export function useIsPlatformAdmin(): boolean {
  return usePlatformAdminState().isPlatformAdmin
}
