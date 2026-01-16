import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function routeSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anon) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY")
  }

  const cookieStore = cookies()
  const pendingCookies: any[] = []
  const extraCookies: Array<{ name: string; value: string; options?: any }> = []

  const sb = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        pendingCookies.push(...cookiesToSet)
      },
    },
  })

  const json = (body: any, status = 200) => {
    const res = NextResponse.json(body, { status })

    for (const c of pendingCookies) {
      res.cookies.set(c.name, c.value, c.options)
    }
    for (const c of extraCookies) {
      res.cookies.set(c.name, c.value, c.options)
    }

    res.headers.set("cache-control", "no-store, max-age=0")
    return res
  }

  return { sb, json, cookieStore, extraCookies }
}

function isActiveDate(v: any) {
  if (!v) return false
  const t = new Date(v).getTime()
  if (!Number.isFinite(t)) return false
  return t > Date.now()
}

export async function GET() {
  const { sb, json, cookieStore, extraCookies } = routeSupabase()

  // device cookie нужен всегда
  let deviceHash = cookieStore.get("turbotaai_device")?.value ?? null
  if (!deviceHash) {
    deviceHash = crypto.randomUUID()
    extraCookies.push({
      name: "turbotaai_device",
      value: deviceHash,
      options: { path: "/", sameSite: "lax", httpOnly: false, maxAge: 60 * 60 * 24 * 365 },
    })
  }

  const { data: userData } = await sb.auth.getUser()
  const user = userData?.user ?? null

  const trial = Number(process.env.TRIAL_QUESTIONS_LIMIT ?? "5")
  const now = new Date().toISOString()

  let grant: any = null

  // ВАЖНО:
  // - для logged-in работаем строго с grant по user_id
  // - для guest работаем строго с grant по device_hash где user_id IS NULL
  if (user) {
    const { data: byUser } = await sb
      .from("access_grants")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle()

    if (byUser) {
      grant = byUser
    } else {
      // берём гостевой grant по устройству (ТОЛЬКО user_id IS NULL)
      const { data: byGuestDevice } = await sb
        .from("access_grants")
        .select("*")
        .eq("device_hash", deviceHash)
        .is("user_id", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()

      // создаём отдельный user-grant (не трогаем guest)
      const { data: created } = await sb
        .from("access_grants")
        .insert({
          id: crypto.randomUUID(),
          user_id: user.id,
          device_hash: deviceHash,
          trial_questions_left: Number(byGuestDevice?.trial_questions_left ?? trial),
          paid_until: null,
          promo_until: null,
          created_at: now,
          updated_at: now,
        })
        .select("*")
        .single()

      grant = created ?? null
    }
  } else {
    // guest: берём ТОЛЬКО записи user_id IS NULL
    const { data: byGuestDevice } = await sb
      .from("access_grants")
      .select("*")
      .eq("device_hash", deviceHash)
      .is("user_id", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (byGuestDevice) {
      grant = byGuestDevice
    } else {
      const { data: created } = await sb
        .from("access_grants")
        .insert({
          id: crypto.randomUUID(),
          user_id: null,
          device_hash: deviceHash,
          trial_questions_left: trial,
          paid_until: null,
          promo_until: null,
          created_at: now,
          updated_at: now,
        })
        .select("*")
        .single()

      grant = created ?? null
    }
  }

  const trialLeft = Number(grant?.trial_questions_left ?? trial)
  const paidUntil = grant?.paid_until ?? null
  const promoUntil = grant?.promo_until ?? null

  const paidActive = !!user && isActiveDate(paidUntil)
const promoActive = !!user && isActiveDate(promoUntil)
const access = paidActive ? "Paid" : promoActive ? "Promo" : "Limited"
  const unlimited = paidActive || promoActive

  return json({
    ok: true,
    isLoggedIn: !!user,
    email: user?.email ?? null,
    access,
    unlimited,
    hasAccess: unlimited,

    trialLeft,
    paidUntil,
    promoUntil,
    trialText: promoActive ? "Doctor access" : paidActive ? "Unlimited" : null,
  })
}
