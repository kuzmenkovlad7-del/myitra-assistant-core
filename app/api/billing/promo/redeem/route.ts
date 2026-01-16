import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function addMonthsSafe(date: Date, months: number) {
  const d = new Date(date)
  const day = d.getDate()
  d.setMonth(d.getMonth() + months)
  if (d.getDate() !== day) d.setDate(0)
  return d
}

export async function POST(req: Request) {
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
  const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!SUPABASE_URL || !SUPABASE_ANON) {
    return NextResponse.json(
      {
        ok: false,
        error: "Supabase env is missing",
        missing: ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"],
      },
      { status: 500 }
    )
  }

  const cookieStore = cookies()

  // SSR клиент сам прочитает auth cookies Supabase
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value
      },
      set() {},
      remove() {},
    },
  })

  const { data: userData, error: userErr } = await supabase.auth.getUser()
  const user = userData?.user

  if (userErr || !user) {
    return NextResponse.json(
      {
        ok: false,
        error: "Unauthorized",
        details: userErr?.message || "No user session",
        hint: "Check that fetch() uses credentials: include",
      },
      { status: 401 }
    )
  }

  const body = await req.json().catch(() => ({} as any))
  const code = String(body?.code ?? "").trim()

  if (!code) {
    return NextResponse.json({ ok: false, error: "Promo code is required" }, { status: 400 })
  }

  const expected = String(process.env.PROMO_DOCTORS_CODE ?? "DOCTOR12FREE").trim()
  const months = Number(process.env.PROMO_DOCTORS_MONTHS ?? "12") || 12

  if (code.toUpperCase() !== expected.toUpperCase()) {
    return NextResponse.json({ ok: false, error: "Invalid promo code" }, { status: 400 })
  }

  const promoUntil = addMonthsSafe(new Date(), months).toISOString()

  // пробуем update / insert разными схемами на случай отличий колонок
  const updateAttempts: any[] = [
    { promo_until: promoUntil, promo_code: code.toUpperCase() },
    { promo_until: promoUntil },
    { promo_valid_until: promoUntil, promo_code: code.toUpperCase() },
    { promo_expires_at: promoUntil, promo_code: code.toUpperCase() },
  ]

  let lastError: any = null

  for (const payload of updateAttempts) {
    const { error } = await supabase.from("access_grants").update(payload).eq("user_id", user.id)
    if (!error) return NextResponse.json({ ok: true, promoUntil })
    lastError = error
  }

  const insertAttempts: any[] = [
    { user_id: user.id, kind: "promo", valid_until: promoUntil, promo_code: code.toUpperCase() },
    { user_id: user.id, type: "promo", expires_at: promoUntil, promo_code: code.toUpperCase() },
    { user_id: user.id, access_type: "promo", access_until: promoUntil, promo_code: code.toUpperCase() },
    { user_id: user.id, promo_until: promoUntil, promo_code: code.toUpperCase() },
  ]

  for (const row of insertAttempts) {
    const { error } = await supabase.from("access_grants").insert(row)
    if (!error) return NextResponse.json({ ok: true, promoUntil })
    lastError = error
  }

  return NextResponse.json(
    {
      ok: false,
      error: "Failed to apply promo",
      promoUntil,
      details: lastError?.message || lastError,
    },
    { status: 500 }
  )
}
