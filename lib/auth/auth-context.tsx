"use client"

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react"
import {
  getSupabaseBrowserClient,
  hasSupabaseEnv,
} from "@/lib/supabase-client"

type AuthContextType = {
  user: any | null
  loading: boolean
  authDisabled: boolean
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signUp: (
    email: string,
    password: string,
    extra?: { fullName?: string },
  ) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!hasSupabaseEnv) {
      setLoading(false)
      return
    }

    const supabase = getSupabaseBrowserClient()
    if (!supabase) {
      setLoading(false)
      return
    }

    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const signIn = async (email: string, password: string) => {
    if (!hasSupabaseEnv) {
      return { error: new Error("Auth is disabled") }
    }
    const supabase = getSupabaseBrowserClient()
    const { error } = await supabase!.auth.signInWithPassword({
      email,
      password,
    })
    return { error: error as Error | null }
  }

  const signUp = async (
    email: string,
    password: string,
    extra?: { fullName?: string },
  ) => {
    if (!hasSupabaseEnv) {
      return { error: new Error("Auth is disabled") }
    }
    const supabase = getSupabaseBrowserClient()
    const { error } = await supabase!.auth.signUp({
      email,
      password,
      options: {
        data: extra?.fullName ? { full_name: extra.fullName } : undefined,
      },
    })
    return { error: error as Error | null }
  }

  const signOut = async () => {
    if (!hasSupabaseEnv) return
    const supabase = getSupabaseBrowserClient()
    await supabase!.auth.signOut()
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        authDisabled: !hasSupabaseEnv,
        signIn,
        signUp,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider")
  }
  return ctx
}
