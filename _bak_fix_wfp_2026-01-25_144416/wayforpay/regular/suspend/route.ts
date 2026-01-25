import { NextResponse } from "next/server"
import crypto from "crypto"
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
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
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

function md5(s: string) {
  return crypto.createHash("md5").update(s).digest("hex")
}

function isMd5(s: string) {
  return /^[a-f0-9]{32}$/i.test(s)
}

export async function POST() {
  const { userId, error } = await getUserIdFromSession()
  if (!userId) return NextResponse.json({ ok: false, error }, { status: 401 })

  const merchantAccount = String(process.env.WAYFORPAY_MERCHANT_ACCOUNT ?? "").trim()
  const passMd5Env = String(process.env.WAYFORPAY_MERCHANT_PASSWORD_MD5 ?? "").trim()
  const passRawEnv = String(process.env.WAYFORPAY_MERCHANT_PASSWORD ?? "").trim()

  const merchantPassword = passMd5Env || (passRawEnv ? (isMd5(passRawEnv) ? passRawEnv : md5(passRawEnv)) : "")
  if (!merchantAccount || !merchantPassword) {
    return NextResponse.json(
      { ok: false, error: "Missing WAYFORPAY_MERCHANT_ACCOUNT or WAYFORPAY_MERCHANT_PASSWORD(_MD5)" },
      { status: 500 }
    )
  }

  const admin = getSupabaseAdmin()

  const prof = await admin
    .from("profiles")
    .select("wfp_order_reference")
    .eq("id", userId)
    .maybeSingle()

  const orderReference = (prof.data as any)?.wfp_order_reference ?? null
  if (!orderReference) {
    return NextResponse.json({ ok: false, error: "Missing wfp_order_reference in profile" }, { status: 400 })
  }

  const body = {
    requestType: "SUSPEND",
    merchantAccount,
    merchantPassword,
    orderReference,
  }

  const r = await fetch("https://api.wayforpay.com/regularApi", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })

  const data = await r.json().catch(() => ({} as any))
  if (!r.ok || Number(data?.reasonCode ?? 0) !== 4100) {
    return NextResponse.json({ ok: false, error: "WayForPay SUSPEND failed", response: data }, { status: 400 })
  }

  await admin
    .from("profiles")
    .update({ auto_renew: false, subscription_status: "canceled" })
    .eq("id", userId)

  return NextResponse.json({ ok: true })
}
