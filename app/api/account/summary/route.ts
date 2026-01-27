import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import { randomUUID } from "crypto"
import { getSupabaseAdmin } from "@/lib/supabase-admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const DEVICE_COOKIE = "ta_device_hash"
const ACCOUNT_PREFIX = "account:"

type GrantRow = {
  id: string
  user_id: string | null
  device_hash: string
  trial_questions_left: number | null
  paid_until: any
  promo_until: any
  created_at?: string | null
  updated_at?: string | null
}

function num(v: any, fallback = 0) {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

function getTrialLimit() {
  const limit = num(process.env.TRIAL_QUESTIONS_LIMIT, 5)
  return limit > 0 ? Math.floor(limit) : 5
}

function clampTrial(v: any, trialDefault: number) {
  const n = Number(v)
  if (!Number.isFinite(n)) return trialDefault
  if (n < 0) return 0
  return Math.min(Math.floor(n), trialDefault)
}

function toDateOrNull(v: any): Date | null {
  if (!v) return null
  const d = new Date(String(v))
  if (Number.isNaN(d.getTime())) return null
  return d
}

function laterDateIso(a: any, b: any): string | null {
  const da = toDateOrNull(a)
  const db = toDateOrNull(b)
  if (!da && !db) return null
  if (da && !db) return da.toISOString()
  if (!da && db) return db.toISOString()
  return (da!.getTime() >= db!.getTime() ? da! : db!).toISOString()
}

function isFuture(iso: string | null) {
  if (!iso) return false
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return false
  return d.getTime() > Date.now()
}

function routeSessionSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anon) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY")

  const cookieStore = cookies()
  const pendingCookies: any[] = []

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
    for (const c of pendingCookies) res.cookies.set(c.name, c.value, c.options)
    res.headers.set("cache-control", "no-store, max-age=0")
    return res
  }

  return { sb, cookieStore, json }
}

async function findGrantByDevice(admin: any, deviceHash: string): Promise<GrantRow | null> {
  const { data } = await admin
    .from("access_grants")
    .select("*")
    .eq("device_hash", deviceHash)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  return (data ?? null) as GrantRow | null
}

async function createGrant(admin: any, opts: { userId: string | null; deviceHash: string; trialLeft: number; nowIso: string }) {
  const { data } = await admin
    .from("access_grants")
    .insert({
      id: randomUUID(),
      user_id: opts.userId,
      device_hash: opts.deviceHash,
      trial_questions_left: opts.trialLeft,
      paid_until: null,
      promo_until: null,
      created_at: opts.nowIso,
      updated_at: opts.nowIso,
    })
    .select("*")
    .single()

  return (data ?? null) as GrantRow | null
}

async function updateGrant(admin: any, id: string, patch: any) {
  const { data } = await admin.from("access_grants").update(patch).eq("id", id).select("*").maybeSingle()
  return (data ?? null) as GrantRow | null
}

async function ensureGrant(
  admin: any,
  deviceHash: string,
  userId: string | null,
  trialDefault: number,
  nowIso: string
): Promise<GrantRow> {
  let g = await findGrantByDevice(admin, deviceHash)

  if (!g) {
    g = await createGrant(admin, { userId, deviceHash, trialLeft: trialDefault, nowIso })
  }
  if (!g) g = await findGrantByDevice(admin, deviceHash)
  if (!g) throw new Error("GRANT_CREATE_FAILED")

  if (userId && !g.user_id) {
    const upd = await updateGrant(admin, g.id, { user_id: userId, updated_at: nowIso })
    if (upd) g = upd
  }

  return g
}

export async function GET() {
  const { sb, cookieStore, json } = routeSessionSupabase()
  const admin = getSupabaseAdmin()

  const trialDefault = getTrialLimit()
  const nowIso = new Date().toISOString()

  let deviceHash = cookieStore.get(DEVICE_COOKIE)?.value ?? null
  let needSetDeviceCookie = false
  if (!deviceHash) {
    deviceHash = randomUUID()
    needSetDeviceCookie = true
  }

  const { data: userData } = await sb.auth.getUser()
  const user = userData?.user ?? null
  const isLoggedIn = Boolean(user?.id)

  // guest grant always exists
  let guestGrant = await ensureGrant(admin, deviceHash!, null, trialDefault, nowIso)

  // account grant if logged in
  let accountGrant: GrantRow | null = null
  let accountHash: string | null = null

  if (isLoggedIn) {
    accountHash = `${ACCOUNT_PREFIX}${user!.id}`

    // legacy migration: если есть запись по user_id (например device_hash null/другой) — фиксируем на accountHash
    try {
      const { data: legacy } = await admin
        .from("access_grants")
        .select("*")
        .eq("user_id", user!.id)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle()

      if (legacy?.id && String(legacy.device_hash || "") !== accountHash) {
        await updateGrant(admin, legacy.id, { device_hash: accountHash, updated_at: nowIso })
      }
    } catch {}

    accountGrant = await ensureGrant(admin, accountHash, user!.id, trialDefault, nowIso)

    // sync trial (min guest/account)
    const gLeft = clampTrial(guestGrant?.trial_questions_left ?? trialDefault, trialDefault)
    const aLeft = clampTrial(accountGrant?.trial_questions_left ?? trialDefault, trialDefault)
    const eff = Math.min(gLeft, aLeft)

    if (gLeft !== eff) {
      guestGrant = (await updateGrant(admin, guestGrant.id, { trial_questions_left: eff, updated_at: nowIso })) ?? guestGrant
    }
    if (aLeft !== eff && accountGrant) {
      accountGrant =
        (await updateGrant(admin, accountGrant.id, { trial_questions_left: eff, updated_at: nowIso })) ?? accountGrant
    }
  }

  // entitlements are always from grants
  const guestPaid = guestGrant?.paid_until ? String(guestGrant.paid_until) : null
  const guestPromo = guestGrant?.promo_until ? String(guestGrant.promo_until) : null

  const accPaid = accountGrant?.paid_until ? String(accountGrant.paid_until) : null
  const accPromo = accountGrant?.promo_until ? String(accountGrant.promo_until) : null

  let paidUntil = isLoggedIn ? laterDateIso(guestPaid, accPaid) : guestPaid
  let promoUntil = isLoggedIn ? laterDateIso(guestPromo, accPromo) : guestPromo

  // if logged in, propagate merged entitlements to both grants
  if (isLoggedIn && accountGrant && accountHash) {
    const needUpdGuest = (paidUntil || null) !== (guestPaid || null) || (promoUntil || null) !== (guestPromo || null)
    const needUpdAcc = (paidUntil || null) !== (accPaid || null) || (promoUntil || null) !== (accPromo || null)

    if (needUpdGuest) {
      guestGrant =
        (await updateGrant(admin, guestGrant.id, { paid_until: paidUntil, promo_until: promoUntil, updated_at: nowIso })) ??
        guestGrant
    }

    if (needUpdAcc) {
      accountGrant =
        (await updateGrant(admin, accountGrant.id, { paid_until: paidUntil, promo_until: promoUntil, updated_at: nowIso })) ??
        accountGrant
    }

    // best-effort: sync subscription meta in profiles, if fields exist
    try {
      await admin
        .from("profiles")
        .update({
          subscription_status: isFuture(paidUntil) || isFuture(promoUntil) ? "active" : "inactive",
          updated_at: nowIso,
        } as any)
        .eq("id", user!.id)
    } catch {}
  }

  // subscription meta
  let autoRenew = false
  let subscriptionStatus = ""

  if (isLoggedIn) {
    try {
      const { data: p } = await admin
        .from("profiles")
        .select("auto_renew,autorenew,subscription_status")
        .eq("id", user!.id)
        .maybeSingle()

      autoRenew = Boolean((p as any)?.auto_renew ?? (p as any)?.autorenew ?? false)
      subscriptionStatus = String((p as any)?.subscription_status ?? "")
    } catch {}
  }

  const accessUntil = laterDateIso(paidUntil, promoUntil)
  const paidActive = isFuture(paidUntil)
  const promoActive = isFuture(promoUntil)
  const unlimited = paidActive || promoActive

  const trialLeft = clampTrial(
    (isLoggedIn ? accountGrant?.trial_questions_left : guestGrant?.trial_questions_left) ?? trialDefault,
    trialDefault
  )

  const access = paidActive ? "Paid" : promoActive ? "Promo" : "Trial"

  const payload = {
    ok: true,
    isLoggedIn,
    user: isLoggedIn ? { id: user!.id, email: user!.email } : null,

    access,
    unlimited,
    hasAccess: unlimited,

    trial_questions_left: trialLeft,
    trial_left: trialLeft,
    trialLeft,

    paidUntil,
    promoUntil,
    accessUntil,

    autoRenew,
    subscriptionStatus: subscriptionStatus || (unlimited ? "active" : "inactive"),
  }

  const res = json(payload)

  if (needSetDeviceCookie) {
    res.cookies.set(DEVICE_COOKIE, deviceHash!, {
      path: "/",
      sameSite: "lax",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 365,
    })
  }

  return res
}
