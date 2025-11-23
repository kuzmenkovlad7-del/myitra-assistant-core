import { createClient as createSupabaseClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createSupabaseClient(supabaseUrl, supabaseAnonKey)

// Re-export createClient for compatibility
export { createClient } from "@supabase/supabase-js"

// Default export
export default supabase

// Create a singleton instance for the browser client
let browserClient: ReturnType<typeof createSupabaseClient> | null = null

export function getSupabaseBrowserClient() {
  if (browserClient) return browserClient

  try {
    browserClient = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
      global: {
        fetch: (url, options = {}) => {
          return fetch(url, {
            ...options,
            signal: AbortSignal.timeout(10000),
          }).catch((error) => {
            console.error("Supabase browser client fetch error:", error)
            throw new Error("Network connection failed")
          })
        },
      },
    })

    return browserClient
  } catch (error) {
    console.error("Failed to create Supabase browser client:", error)
    return null
  }
}

// Create a server client (to be used in server components or API routes)
export function getSupabaseServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ""

  if (!supabaseUrl || !supabaseServiceKey) {
    console.warn("Missing Supabase server environment variables")
    return null
  }

  try {
    return createSupabaseClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
      },
      global: {
        fetch: (url, options = {}) => {
          return fetch(url, {
            ...options,
            signal: AbortSignal.timeout(15000),
          }).catch((error) => {
            console.error("Supabase server client fetch error:", error)
            throw new Error("Network connection failed")
          })
        },
      },
    })
  } catch (error) {
    console.error("Failed to create Supabase server client:", error)
    return null
  }
}
