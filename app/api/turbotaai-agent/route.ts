import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function num(v: string | undefined, fallback = 0) {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

function getTrialLimit() {
  const raw = process.env.TRIAL_QUESTIONS_LIMIT
  const limit = num(raw, 5)
  return limit > 0 ? Math.floor(limit) : 5
}

function isActiveDate(v: any) {
  if (!v) return false
  const t = new Date(v).getTime()
  if (!Number.isFinite(t)) return false
  return t > Date.now()
}

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

  const applyPendingCookies = (res: NextResponse) => {
    for (const c of pendingCookies) {
      res.cookies.set(c.name, c.value, c.options)
    }
  }

  return { sb, cookieStore, extraCookies, applyPendingCookies }
}

export async function POST(req: NextRequest) {
  const { sb, cookieStore, extraCookies, applyPendingCookies } = routeSupabase()

  // device cookie (как в summary)
  let deviceHash = cookieStore.get("turbotaai_device")?.value ?? null
  if (!deviceHash) {
    deviceHash = crypto.randomUUID()
    extraCookies.push({
      name: "turbotaai_device",
      value: deviceHash,
      options: { path: "/", sameSite: "lax", httpOnly: false, maxAge: 60 * 60 * 24 * 365 },
    })
  }

  const trialDefault = getTrialLimit()
  const nowIso = new Date().toISOString()

  const { data: userData } = await sb.auth.getUser()
  const user = userData?.user ?? null

  // 1) достаём / создаём grant так же, как summary
  let grant: any = null

  if (user) {
    const { data: byUser } = await sb
      .from("access_grants")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle()

    if (byUser) {
      grant = byUser
    } else {
      const { data: byDevice } = await sb
        .from("access_grants")
        .select("*")
        .eq("device_hash", deviceHash)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()

      if (byDevice?.id) {
        const { data: updated } = await sb
          .from("access_grants")
          .update({ user_id: user.id, updated_at: nowIso })
          .eq("id", byDevice.id)
          .select("*")
          .single()

        grant = updated ?? byDevice
      } else {
        const { data: created } = await sb
          .from("access_grants")
          .insert({
            id: crypto.randomUUID(),
            user_id: user.id,
            device_hash: deviceHash,
            trial_questions_left: trialDefault,
            paid_until: null,
            promo_until: null,
            created_at: nowIso,
            updated_at: nowIso,
          })
          .select("*")
          .single()

        grant = created ?? null
      }
    }
  } else {
    const { data: byDevice } = await sb
      .from("access_grants")
      .select("*")
      .eq("device_hash", deviceHash)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (byDevice) {
      grant = byDevice
    } else {
      const { data: created } = await sb
        .from("access_grants")
        .insert({
          id: crypto.randomUUID(),
          user_id: null,
          device_hash: deviceHash,
          trial_questions_left: trialDefault,
          paid_until: null,
          promo_until: null,
          created_at: nowIso,
          updated_at: nowIso,
        })
        .select("*")
        .single()

      grant = created ?? null
    }
  }

  const trialLeft = Math.max(0, Number(grant?.trial_questions_left ?? trialDefault))
  const paidUntil = grant?.paid_until ?? null
  const promoUntil = grant?.promo_until ?? null

  const paidActive = isActiveDate(paidUntil)
  const promoActive = isActiveDate(promoUntil)
  const unlimited = paidActive || promoActive

  // 2) блокируем только Limited
  if (!unlimited && trialLeft <= 0) {
    const res = NextResponse.json(
      { ok: false, error: "PAYMENT_REQUIRED", reason: "trial_limit_reached", trialLeft },
      { status: 402 }
    )
    for (const c of extraCookies) res.cookies.set(c.name, c.value, c.options)
    applyPendingCookies(res)
    res.headers.set("x-access", "Limited")
    res.headers.set("x-trial-left", String(trialLeft))
    res.headers.set("cache-control", "no-store, max-age=0")
    return res
  }

  // 3) проксируем в n8n
  const upstream = String(process.env.N8N_TURBOTA_AGENT_WEBHOOK_URL || "").trim()
  if (!upstream) {
    const res = NextResponse.json({ ok: false, error: "Missing N8N_TURBOTA_AGENT_WEBHOOK_URL" }, { status: 500 })
    for (const c of extraCookies) res.cookies.set(c.name, c.value, c.options)
    applyPendingCookies(res)
    return res
  }

  const contentType = req.headers.get("content-type") || "application/json"
  const bodyText = await req.text()

  const upstreamRes = await fetch(upstream, {
    method: "POST",
    headers: { "content-type": contentType },
    body: bodyText,
    cache: "no-store",
  })

  const text = await upstreamRes.text()

  // 4) если успешный ответ и НЕ unlimited → уменьшаем trial_questions_left
  let nextTrialLeft = trialLeft
  if (upstreamRes.ok && !unlimited) {
    nextTrialLeft = Math.max(0, trialLeft - 1)
    try {
      await sb
        .from("access_grants")
        .update({ trial_questions_left: nextTrialLeft, updated_at: nowIso })
        .eq("id", grant?.id)
    } catch {}
  }

  const res = new NextResponse(text, {
    status: upstreamRes.status,
    headers: {
      "content-type": upstreamRes.headers.get("content-type") || "application/json",
    },
  })

  for (const c of extraCookies) res.cookies.set(c.name, c.value, c.options)
  applyPendingCookies(res)

  res.headers.set("x-access", paidActive ? "Paid" : promoActive ? "Promo" : "Limited")
  res.headers.set("x-trial-left", String(nextTrialLeft))
  res.headers.set("cache-control", "no-store, max-age=0")

  return res
}
