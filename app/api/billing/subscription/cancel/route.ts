import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import { getSupabaseAdmin } from "@/lib/supabase-admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const ACCOUNT_PREFIX = "account:"

async function getUserIdFromSession() {
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
  const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!SUPABASE_URL || !SUPABASE_ANON) return { userId: null, error: "Missing Supabase public env" }

  const cookieStore = cookies()
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value
      },
      set() {},
      remove() {},
    },
  })

  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user?.id) return { userId: null, error: error?.message || "Unauthorized" }
  return { userId: data.user.id, error: null }
}

export async function POST() {
  const { userId, error } = await getUserIdFromSession()
  if (!userId) return NextResponse.json({ ok: false, error }, { status: 401 })

  const admin = getSupabaseAdmin()
  const nowIso = new Date().toISOString()

  // Update profiles: canceled_at (one L)
  await admin
    .from("profiles")
    .update({
      auto_renew: false,
      subscription_status: "canceled",
      cancel_at_period_end: true,
      canceled_at: nowIso,
      updated_at: nowIso,
    } as any)
    .eq("id", userId)

  // Update access_grants: cancelled_at (two L)
  const accountKey = `${ACCOUNT_PREFIX}${userId}`
  await admin
    .from("access_grants")
    .update({
      auto_renew: false,
      cancelled_at: nowIso,
      updated_at: nowIso,
    } as any)
    .eq("device_hash", accountKey)

  return NextResponse.json({ ok: true })
}
