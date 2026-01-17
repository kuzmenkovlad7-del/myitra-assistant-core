import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

function stripQuotes(v: string) {
  return v.replace(/^['"]|['"]$/g, "")
}

function getEnv(name: string): string {
  const raw = process.env[name] ?? ""
  return stripQuotes(raw)
}

/**
 * Server-side Supabase client (SSR / Route Handlers)
 * Требует NEXT_PUBLIC_SUPABASE_URL и NEXT_PUBLIC_SUPABASE_ANON_KEY
 */
export function createSupabaseServerClient() {
  const cookieStore = cookies()

  const url = getEnv("NEXT_PUBLIC_SUPABASE_URL")
  const anonKey = getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY")

  if (!url || !anonKey) {
    throw new Error("Missing env: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY")
  }

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        } catch {
          // В некоторых контекстах cookies() read-only — игнорируем
        }
      },
    },
  })
}

// alias (на всякий случай, чтобы не ломать импорты)
export const getSupabaseServerClient = createSupabaseServerClient
