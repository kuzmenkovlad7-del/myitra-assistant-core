"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import type { User, Session } from "@supabase/supabase-js"
import { supabase } from "@/lib/supabase-client"

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<any>
  signUp: (email: string, password: string, username?: string) => Promise<any>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<any>
  updateProfile: (updates: { username?: string; avatar_url?: string | null }) => Promise<{ error?: any }>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession()
        if (error) {
          console.error("Error getting session:", error)
        } else {
          setSession(session)
          setUser(session?.user ?? null)
        }
      } catch (error) {
        console.error("Error in getInitialSession:", error)
      } finally {
        setLoading(false)
      }
    }

    getInitialSession()

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => {
      try {
        subscription?.unsubscribe()
      } catch (error) {
        console.error("Error unsubscribing from auth changes:", error)
      }
    }
  }, [])

  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      return { data, error }
    } catch (error) {
      console.error("Error signing in:", error)
      return { data: null, error }
    }
  }

  const signUp = async (email: string, password: string, username?: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username: username || "",
          },
        },
      })
      return { data, error }
    } catch (error) {
      console.error("Error signing up:", error)
      return { data: null, error }
    }
  }

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) {
        console.error("Error signing out:", error)
      }
    } catch (error) {
      console.error("Error in signOut:", error)
    }
  }

  const resetPassword = async (email: string) => {
    try {
      const { data, error } = await supabase.auth.resetPasswordForEmail(email)
      return { data, error }
    } catch (error) {
      console.error("Error resetting password:", error)
      return { data: null, error }
    }
  }

  const updateProfile = async (updates: { username?: string; avatar_url?: string | null }) => {
    try {
      if (!user) {
        return { error: new Error("No user logged in") }
      }

      // Update user metadata in Supabase Auth
      const { data, error } = await supabase.auth.updateUser({
        data: {
          username: updates.username,
          avatar_url: updates.avatar_url,
        },
      })

      if (error) {
        return { error }
      }

      // Update local user state
      if (data.user) {
        setUser(data.user)
      }

      return { error: null }
    } catch (error) {
      console.error("Error updating profile:", error)
      return { error }
    }
  }

  const value = {
    user,
    session,
    loading,
    signIn,
    signUp,
    signOut,
    resetPassword,
    updateProfile,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
