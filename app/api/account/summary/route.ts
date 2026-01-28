import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import { createClient } from "@supabase/supabase-js"
import { randomUUID } from "crypto"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const DEVICE_COOKIE = "ta_device_hash"
const ACCOUNT_PREFIX = "account:"

type GrantRow = {
  id?: string
  user_id?: string | null
  device_hash: string
  trial_questions_left?: number | null
  paid_until?: any
  promo_until?: any
  updated_at?: string | null
  created_at?: string | null
}

function env(name: string) {
  return String(process.env[name] || "").trim()
}

function num(v: any, fallback: number) {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

function trialDefault() {
  const n = num(process.env.TRIAL_QUESTIONS_LIMIT, 5)
  return n > 0 ? Math.floor(n) : 5
}

function toDateOrNull(v: any): Date | null {
  if (!v) return null
  const d = new Date(String(v))
  if (Number.isNaN(d.getTime())) return null
  return d
}

function laterIso(a: any, b: any): string | null {
  const da = toDateOrNull(a)
  const db = toDateOrNull(b)
  if (!da && !db) return null
  if (da && !db) return da.toISOString()
  if (!da && db) return db.toISOString()
  return (da!.getTime() >= db!.getTime() ? da! : db!).toISOString()
}

function isFuture(v: any) {
  const d = toDateOrNull(v)
  return !!d && d.getTime() > Date.now()
}

function cookieDomainFromHost(host: string | null) {
  const h = String(host || "").toLowerCase()
  if (h === "turbotaai.com" || h.endsWith(".turbotaai.com")) return ".turbotaai.com"
  return undefined
}

function makeAdmin() {
  const url = env("NEXT_PUBLIC_SUPABASE_URL") || env("SUPABASE_URL")
  const key = env("SUPABASE_SERVICE_ROLE_KEY") || env("SUPABASE_SERVICE_KEY")
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
}

async function getUserFromCookies(): Promise<{ userId: string | null; email: string | null; pending: any[] }> {
  const url = env("NEXT_PUBLIC_SUPABASE_URL")
  const anon = env("NEXT_PUBLIC_SUPABASE_ANON_KEY")
  const pending: any[] = []
  if (!url || !anon) return { userId: null, email: null, pending }

  const jar = cookies()

  const sb = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return jar.getAll()
      },
      setAll(list) {
        pending.push(...list)
      },
    },
  })

  try {
    const { data } = await sb.auth.getUser()
    return { userId: data?.user?.id ?? null, email: (data?.user?.email as any) ?? null, pending }
  } catch {
    return { userId: null, email: null, pending }
  }
}

async function findGrant(admin: any, key: string): Promise<GrantRow | null> {
  const { data, error } = await admin.from("access_grants").select("*").eq("device_hash", key).maybeSingle()
  if (error) return null
  return (data ?? null) as GrantRow | null
}

async function ensureGrant(admin: any, key: string, userId: string | null, trial: number, nowIso: string): Promise<GrantRow> {
  let g = await findGrant(admin, key)

  if (!g) {
    const ins = await admin
      .from("access_grants")
      .insert({
        id: randomUUID(),
        user_id: userId,
        device_hash: key,
        trial_questions_left: trial,
        paid_until: null,
        promo_until: null,
        created_at: nowIso,
        updated_at: nowIso,
      } as any)
      .select("*")
      .maybeSingle()

    g = (ins.data ?? null) as any
  }

  if (!g) g = await findGrant(admin, key)

  // если появился userId — привяжем (но без фанатизма)
  if (g && userId && !g.user_id) {
    const up = await admin
      .from("access_grants")
      .update({ user_id: userId, updated_at: nowIso } as any)
      .eq("device_hash", key)
      .select("*")
      .maybeSingle()
    g = ((up.data ?? g) as any) as GrantRow
  }

  return (
    g ?? {
      id: randomUUID(),
      user_id: userId,
      device_hash: key,
      trial_questions_left: trial,
      paid_until: null,
      promo_until: null,
      created_at: nowIso,
      updated_at: nowIso,
    }
  )
}

async function readProfile(admin: any, userId: string) {
  const cols = "paid_until,promo_until,auto_renew,autorenew,subscription_status"
  const r1 = await admin.from("profiles").select(cols).eq("id", userId).maybeSingle()
  if (!r1?.error && r1?.data) return r1.data
  const r2 = await admin.from("profiles").select(cols).eq("user_id", userId).maybeSingle()
  if (!r2?.error && r2?.data) return r2.data
  return null
}

export async function GET(req: NextRequest) {
  const nowIso = new Date().toISOString()
  const trial = trialDefault()

  const jar = cookies()
  const host = req.headers.get("host")
  const domain = cookieDomainFromHost(host)

  let deviceHash = String(jar.get(DEVICE_COOKIE)?.value || "").trim()
  let needSetDeviceCookie = false
  if (!deviceHash) {
    deviceHash = randomUUID()
    needSetDeviceCookie = true
  }

  const { userId, email, pending } = await getUserFromCookies()
  const isLoggedIn = Boolean(userId)
  const accountKey = isLoggedIn && userId ? `${ACCOUNT_PREFIX}${userId}` : null

  const admin = makeAdmin()

  // если нет service role — возвращаем стабильный trial, но device cookie всё равно фиксируем
  if (!admin) {
    const res = NextResponse.json(
      {
        ok: true,
        isLoggedIn,
        userId,
        email,
        deviceHash,
        access: "trial",
        hasAccess: true,
        unlimited: false,
        trial_questions_left: trial,
        questionsLeft: trial,
        paid_until: null,
        paidUntil: null,
        promo_until: null,
        promoUntil: null,
        access_until: null,
        accessUntil: null,
        hasPaid: false,
        hasPromo: false,
        subscription_status: "inactive",
        auto_renew: false,
        error: "Missing SUPABASE_SERVICE_ROLE_KEY",
      },
      { status: 200 }
    )

    if (needSetDeviceCookie) {
      res.cookies.set(DEVICE_COOKIE, deviceHash, {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 24 * 365,
        domain,
      })
    }

    for (const c of pending) res.cookies.set(c.name, c.value, c.options)
    res.headers.set("cache-control", "no-store, max-age=0")
    return res
  }

  // guest grant всегда существует
  const guest = await ensureGrant(admin, deviceHash, null, trial, nowIso)

  // account grant — только если залогинен
  const account = accountKey ? await ensureGrant(admin, accountKey, userId!, 0, nowIso) : null

  const guestTrialLeft = Math.max(0, Math.min(trial, Number(guest.trial_questions_left ?? trial)))
  const paid_until = laterIso(guest.paid_until, account?.paid_until)
  const promo_until = laterIso(guest.promo_until, account?.promo_until)
  const accessUntil = laterIso(paid_until, promo_until)

  const hasPaid = isFuture(paid_until)
  const hasPromo = !hasPaid && isFuture(promo_until) // если paid есть — promo вторично
  const hasAccess = hasPaid || hasPromo || guestTrialLeft > 0

  const access =
    hasPaid ? "paid" : hasPromo ? "promo" : guestTrialLeft > 0 ? "trial" : "none"

  const prof = isLoggedIn && userId ? await readProfile(admin, userId) : null
  const autoRenewRaw = (prof as any)?.auto_renew ?? (prof as any)?.autorenew ?? false
  const auto_renew = Boolean(autoRenewRaw)

  const subscription_status =
    String((prof as any)?.subscription_status || (hasPaid || hasPromo ? "active" : "inactive"))

  const res = NextResponse.json(
    {
      ok: true,

      isLoggedIn,
      userId,
      email,

      // ключи
      deviceHash,
      guestKey: deviceHash,
      accountKey,

      // доступ
      access,
      hasAccess,
      unlimited: false,

      // trial
      trial_questions_left: guestTrialLeft,
      questionsLeft: guestTrialLeft,

      // paid/promo
      paid_until,
      paidUntil: paid_until,
      promo_until,
      promoUntil: promo_until,
      access_until: accessUntil,
      accessUntil,

      hasPaid,
      hasPromo,

      // подписка
      subscription_status,
      auto_renew,

      // диагностика (не ломает UI, но помогает дебажить)
      _debug: {
        host,
        domain,
        guestRow: guest?.id || null,
        accountRow: account?.id || null,
      },
    },
    { status: 200 }
  )

  if (needSetDeviceCookie) {
    res.cookies.set(DEVICE_COOKIE, deviceHash, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 365,
      domain,
    })
  }

  for (const c of pending) res.cookies.set(c.name, c.value, c.options)
  res.headers.set("cache-control", "no-store, max-age=0")
  return res
}
