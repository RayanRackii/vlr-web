import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import type { Session, User } from "@supabase/supabase-js"

import { supabase } from "@/lib/supabase"

type AuthContextValue = {
  session: Session | null
  user: User | null
  isLoading: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

type AuthProviderProps = {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    async function initializeAuth() {
      const { data, error } = await supabase.auth.getSession()

      if (!isMounted) {
        return
      }

      if (error !== null) {
        setSession(null)
        setUser(null)
        setIsLoading(false)
        return
      }

      setSession(data.session)
      setUser(data.session?.user ?? null)
      setIsLoading(false)
    }

    void initializeAuth()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!isMounted) {
        return
      }

      setSession(nextSession)
      setUser(nextSession?.user ?? null)
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
    }),
    [isLoading, session, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)

  if (context === null) {
    throw new Error("useAuth must be used within an AuthProvider.")
  }

  return context
}
