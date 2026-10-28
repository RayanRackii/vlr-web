import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js"

import { syncCurrentUserCacheToAuthUser } from "@/features/users/services/currentUserCache"
import { logAuthSessionEvent } from "@/lib/authSessionLog"
import { isSigningOut, purgeSignedOutSessions } from "@/lib/signOutMarker"
import { supabase } from "@/lib/supabase"

type AuthContextValue = {
  session: Session | null
  user: User | null
  isLoading: boolean
  expiredSession: { tenantId: string | null } | null
}

const AuthContext = createContext<AuthContextValue | null>(null)

type AuthProviderProps = {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const [expiredSession, setExpiredSession] = useState<AuthContextValue["expiredSession"]>(null)

  useEffect(() => {
    let isMounted = true
    let signedOut = false
    let lastSession: Session | null = null

    function logStaffEvent(
      event: "SIGNED_IN" | "TOKEN_REFRESHED" | "SIGNED_OUT" | "GET_SESSION",
      nextSession: Session | null,
      error?: unknown,
    ) {
      logAuthSessionEvent({
        event,
        surface: "b2b",
        hadSession: nextSession !== null,
        expiresAt: nextSession?.expires_at ?? null,
        error,
      })
    }

    async function initializeAuth() {
      const { data, error } = await supabase.auth.getSession()

      if (!isMounted || signedOut) {
        return
      }

      // Sair already ended this session: render signed out, never a restoring skeleton.
      const session =
        error === null && !isSigningOut() ? (data?.session ?? null) : null
      logStaffEvent("GET_SESSION", session, error ?? undefined)

      if (session === null) {
        syncCurrentUserCacheToAuthUser(null)
        setSession(null)
        setUser(null)
        setIsLoading(false)
        return
      }

      syncCurrentUserCacheToAuthUser(session.user ?? null)
      lastSession = session
      setSession(session)
      setUser(session.user ?? null)
      setIsLoading(false)
    }

    void initializeAuth()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, nextSession) => {
      if (!isMounted) {
        return
      }

      if (
        event === "SIGNED_IN" ||
        event === "TOKEN_REFRESHED" ||
        event === "SIGNED_OUT"
      ) {
        logStaffEvent(event, nextSession)
      }

      if (event === "SIGNED_OUT") {
        if (lastSession && !isSigningOut()) {
          const tenantId: unknown = lastSession.user.app_metadata?.tenant_id
          setExpiredSession({ tenantId: typeof tenantId === "string" ? tenantId : null })
        }
        lastSession = null
        signedOut = true
        syncCurrentUserCacheToAuthUser(null)
        setSession(null)
        setUser(null)
        setIsLoading(false)
        return
      }

      // After Sair, a refresh that was already in flight must not bring the user back.
      if (isSigningOut()) {
        purgeSignedOutSessions()
        return
      }

      // A null session on any other event (refresh race, HMR, BroadcastChannel)
      // must not wipe the user. SIGNED_OUT is the only listener that clears it.
      if (nextSession === null) {
        return
      }

      syncCurrentUserCacheToAuthUser(nextSession.user ?? null)
      lastSession = nextSession
      setExpiredSession(null)
      setSession(nextSession)
      setUser(nextSession.user ?? null)
      setIsLoading(false)
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user,
      isLoading,
      expiredSession,
    }),
    [isLoading, session, user, expiredSession],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// Auth providers and their consumer hook intentionally share this module.
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)

  if (context === null) {
    throw new Error("useAuth must be used within an AuthProvider.")
  }

  return context
}
