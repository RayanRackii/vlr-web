import { useMemo } from "react"

import { useAuth } from "@/contexts/AuthContext"

function parseAdminEmails(): string[] {
  const raw = import.meta.env.VITE_PLATFORM_ADMIN_EMAILS

  if (typeof raw !== "string" || raw.trim().length === 0) {
    return []
  }

  return raw
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter((email) => email.length > 0)
}

export function useIsPlatformAdmin(): boolean {
  const { user } = useAuth()

  return useMemo(() => {
    const email = user?.email?.trim().toLowerCase()

    if (!email) {
      return false
    }

    return parseAdminEmails().includes(email)
  }, [user?.email])
}

export function getTenantBaseDomain(): string {
  const configured = import.meta.env.VITE_TENANT_BASE_DOMAIN

  if (typeof configured === "string" && configured.trim().length > 0) {
    return configured.trim()
  }

  return "rolvix.com.br"
}
