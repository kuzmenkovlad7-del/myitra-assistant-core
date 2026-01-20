import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE ||
    process.env.SUPABASE_SERVICE_KEY

  if (!url || !key) throw new Error("Missing Supabase admin env")
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

async function getUserIdFromSession() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anon) return { userId: null as string | null, error: "Missing Supabase public env" }

  const cookieStore = cookies()
  const supabase = createServerClient(url, anon, {
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

function isActiveDate(v: string | null) {
  if (!v) return false
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return false
  return d.getTime() > Date.now()
}

export async function GET() {
  const { userId, error } = await getUserIdFromSession()
  if (!userId) return NextResponse.json({ ok: false, error }, { status: 401 })

  const admin = getSupabaseAdmin()

  // 1) доступ всегда из access_grants
  const grant = await admin
    .from("access_grants")
    .select("paid_until,promo_until")
    .eq("user_id", userId)
    .maybeSingle()

  const paidUntil = (grant.data as any)?.paid_until ?? null
  const promoUntil = (grant.data as any)?.promo_until ?? null

  const paidActive = isActiveDate(paidUntil)
  const promoActive = isActiveDate(promoUntil)
  const hasAccess = paidActive || promoActive
  const accessUntil = paidActive ? paidUntil : promoActive ? promoUntil : null

  // 2) статус подписки/регулярки из profiles
  const prof = await admin
    .from("profiles")
    .select("auto_renew,subscription_status,wfp_order_reference,wfp_rec_token")
    .eq("id", userId)
    .maybeSingle()

  const autoRenew = !!(prof.data as any)?.auto_renew
  const subscriptionStatus = String((prof.data as any)?.subscription_status ?? "")
  const wfpOrderReference = (prof.data as any)?.wfp_order_reference ?? null
  const wfpRecToken = (prof.data as any)?.wfp_rec_token ?? null

  return NextResponse.json({
    ok: true,
    hasAccess,
    accessUntil,
    paidUntil,
    promoUntil,
    autoRenew,
    subscriptionStatus,
    wfpOrderReference,
    wfpRecToken,
  })
}
