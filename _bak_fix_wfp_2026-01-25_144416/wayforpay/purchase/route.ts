import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import { getSupabaseAdmin } from "@/lib/supabase-admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const DEVICE_COOKIE = "turbotaai_device"

function getOrigin(req: NextRequest) {
  const proto = req.headers.get("x-forwarded-proto") || "https"
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host")
  if (host) return `${proto}://${host}`
  return new URL(req.url).origin
}

function pickEnv(...keys: string[]) {
  for (const k of keys) {
    const v = process.env[k]
    if (v && String(v).trim()) return String(v).trim()
  }
  return ""
}

function hmacMd5Hex(secret: string, data: string) {
  return crypto.createHmac("md5", secret).update(data, "utf8").digest("hex")
}

function planConfig(plan: string | null) {
  const p = (plan || "monthly").toLowerCase()
  if (p === "monthly") {
    return { plan: "monthly", amount: 1, currency: "UAH", days: 30, productName: "TurbotaAI Monthly" }
  }
  return { plan: "monthly", amount: 1, currency: "UAH", days: 30, productName: "TurbotaAI Monthly" }
}

async function getUserIdFromSession() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anon) return null

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

  const { data } = await sb.auth.getUser()
  return data?.user?.id ?? null
}

async function handle(req: NextRequest) {
  const origin = getOrigin(req)

  const merchantAccount = pickEnv("WAYFORPAY_MERCHANT_ACCOUNT", "WAYFORPAY_ACCOUNT", "WFP_MERCHANT_ACCOUNT")
  const secretKey = pickEnv("WAYFORPAY_MERCHANT_SECRET_KEY", "WAYFORPAY_SECRET_KEY", "WAYFORPAY_SECRET", "WFP_SECRET_KEY")

  if (!merchantAccount || !secretKey) {
    return NextResponse.json(
      { ok: false, error: "WayForPay env missing: merchant account / secret key" },
      { status: 500 }
    )
  }

  // !!! ВАЖНО: подписка должна быть привязана к аккаунту
  const userId = await getUserIdFromSession()
  if (!userId) {
    return NextResponse.redirect(`${origin}/login?next=/pricing`, 302)
  }

  // device cookie (для логики grants, не для оплаты)
  const cookieStore = cookies()
  let deviceHash = cookieStore.get(DEVICE_COOKIE)?.value ?? null
  let needSetDeviceCookie = false
  if (!deviceHash) {
    deviceHash = crypto.randomUUID()
    needSetDeviceCookie = true
  }

  let body: any = {}
  if (req.method === "POST") {
    try {
      body = await req.json()
    } catch {
      body = {}
    }
  }

  const planParam =
    req.nextUrl.searchParams.get("planId") ||
    req.nextUrl.searchParams.get("plan") ||
    body?.planId ||
    body?.plan ||
    body?.tier ||
    "monthly"

  const cfg = planConfig(String(planParam))
  const orderReference = `ta_${cfg.plan}_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`
  const orderDate = Math.floor(Date.now() / 1000)

  const merchantDomainName =
    pickEnv("WAYFORPAY_MERCHANT_DOMAIN_NAME", "WAYFORPAY_DOMAIN") || new URL(origin).host

  const productName = [cfg.productName]
  const productCount = [1]
  const productPrice = [cfg.amount]

  const signString = [
    merchantAccount,
    merchantDomainName,
    orderReference,
    String(orderDate),
    String(cfg.amount),
    cfg.currency,
    ...productName.map(String),
    ...productCount.map((x) => String(x)),
    ...productPrice.map((x) => String(x)),
  ].join(";")

  const merchantSignature = hmacMd5Hex(secretKey, signString)

  // !!! ВАЖНО: returnUrl должен вести на существующую страницу
  const returnUrl = `${origin}/payment/result?orderReference=${encodeURIComponent(orderReference)}`
  const serviceUrl = `${origin}/api/billing/wayforpay/webhook`

  const payload = {
    transactionType: "CREATE_INVOICE",
    merchantAccount,
    merchantDomainName,
    merchantSignature,
    apiVersion: 1,
    orderReference,
    orderDate,
    amount: cfg.amount,
    currency: cfg.currency,
    productName,
    productCount,
    productPrice,
    serviceUrl,
    returnUrl,
    language: "UA",
  }

  let wfp: any = null
  try {
    const r = await fetch("https://api.wayforpay.com/api", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    })
    wfp = await r.json()
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "WayForPay request failed", details: String(e?.message || e) },
      { status: 500 }
    )
  }

  const invoiceUrl = wfp?.invoiceUrl || wfp?.payUrl || wfp?.url || null
  if (!invoiceUrl) {
    return NextResponse.json({ ok: false, error: "WayForPay invoiceUrl missing", wfp }, { status: 500 })
  }

  // сохраняем order, чтобы webhook/status могли корректно продлить доступ
  try {
    const admin = getSupabaseAdmin()
    await admin.from("billing_orders").insert({
      order_reference: orderReference,
      user_id: userId,
      status: "invoice_created",
      amount: cfg.amount,
      currency: cfg.currency,
      raw: {
        request: payload,
        response: wfp,
        planId: cfg.plan,
        deviceHash,
      },
    } as any)
  } catch (e) {
    console.error("[billing][purchase] insert billing_orders failed", e)
  }

  // РЕДИРЕКТ В ОПЛАТУ
  const res = NextResponse.redirect(invoiceUrl, 302)

  if (needSetDeviceCookie) {
    res.cookies.set(DEVICE_COOKIE, deviceHash!, {
      path: "/",
      sameSite: "lax",
      httpOnly: false,
      maxAge: 60 * 60 * 24 * 365,
    })
  }

  res.cookies.set("ta_last_order_reference", orderReference, { path: "/", maxAge: 60 * 30 })
  res.headers.set("cache-control", "no-store, max-age=0")
  return res
}

export async function GET(req: NextRequest) {
  return handle(req)
}

export async function POST(req: NextRequest) {
  return handle(req)
}
