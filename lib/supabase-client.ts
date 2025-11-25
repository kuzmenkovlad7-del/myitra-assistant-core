// lib/supabase-client.ts

import { createClient as createSupabaseClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Проверяем, что это действительно http/https URL
const isValidSupabaseUrl =
  typeof supabaseUrl === "string" && /^https?:\/\//.test(supabaseUrl)

export const isSupabaseConfigured = Boolean(isValidSupabaseUrl && supabaseAnonKey)

if (!isSupabaseConfigured && process.env.NODE_ENV === "development") {
  console.warn(
    "[MyITRA] Supabase не настроен. Сайт работает без БД и авторизации.",
    {
      hasUrlEnv: !!supabaseUrl,
      hasAnonKeyEnv: !!supabaseAnonKey,
    },
  )
}

// Клиент для client-side (если Supabase реально включён)
export const supabase =
  isSupabaseConfigured && supabaseUrl && supabaseAnonKey
    ? createSupabaseClient(supabaseUrl, supabaseAnonKey)
    : null

// Клиент для Server Components (с тем же поведением)
export function createServerComponentClient() {
  if (!isSupabaseConfigured || !supabaseUrl || !supabaseAnonKey) {
    return null
  }

  return createSupabaseClient(supabaseUrl, supabaseAnonKey, {
    global: {
      async fetch(input: RequestInfo, init?: RequestInit) {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 10000)

        try {
          const response = await fetch(input, {
            ...init,
            signal: controller.signal,
          })
          return response
        } finally {
          clearTimeout(timeout)
        }
      },
    },
  })
}

// На всякий случай реэкспорт, если где-то импортируется createClient
export { createSupabaseClient as createClient }
