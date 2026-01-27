import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function pickEnv(name: string, fallback = "") {
  const v = (process.env[name] || "").trim()
  return v || fallback
}

function mustEnv(name: string) {
  const v = (process.env[name] || "").trim()
  if (!v) throw new Error(`Missing env: ${name}`)
  return v
}

function hmacMd5(data: string, secret: string) {
  return crypto.createHmac("md5", secret).update(data, "utf8").digest("hex")
}

function normalizeStatus(txStatus: string) {
  const s = (txStatus || "").toLowerCase()
  if (s === "approved") return "paid"
  if (s === "pending" || s === "inprocessing") return "processing"
  if (s === "refunded") return "refunded"
  if (s === "voided" || s === "expired" || s === "declined") return "failed"
  return "unknown"
}

function supabaseAdmin() {
  const url =
    pickEnv("NEXT_PUBLIC_SUPABASE_URL") ||
    pickEnv("SUPABASE_URL") ||
    pickEnv("SUPABASE_PROJECT_URL")

  const key = pickEnv("SUPABASE_SERVICE_ROLE_KEY")

  if (!url) throw new Error("Missing env: SUPABASE_URL")
  if (!key) throw new Error("Missing env: SUPABASE_SERVICE_ROLE_KEY")

  return createClient(url, key, { auth: { persistSession: false } })
}

function addMonthsFromIso(currentIso: string | null, months: number) {
  const now = new Date()
  const current = currentIso ? new Date(currentIso) : null
  const base = current && Number.isFinite(current.getTime()) && current.getTime() > now.getTime() ? current : now

  const d = new Date(base)
  const day = d.getDate()
  d.setMonth(d.getMonth() + months)
  if (d.getDate() !== day) d.setDate(0)
  return d.toISOString()
}

async function wayforpayCheckStatus(orderReference: string) {
  const merchantAccount = mustEnv("WAYFORPAY_MERCHANT_ACCOUNT")
  const secretKey = mustEnv("WAYFORPAY_SECRET_KEY")
  const apiUrl = pickEnv("WAYFORPAY_API_URL", "https://api.wayforpay.com/api")

  const signature = hmacMd5(`${merchantAccount};${orderReference}`, secretKey)

  const payload: any = {
    transactionType: "CHECK_STATUS",
    merchantAccount,
    orderReference,
    merchantSignature: signature,
    apiVersion: 1,
  }

  const r = await fetch(apiUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  })

  const json = await r.json().catch(() => ({}))
  return { httpOk: r.ok, httpStatus: r.status, json }
}

async function upsertBillingOrder(sb: any, orderReference: string, patch: any) {
  await sb.from("billing_orders").upsert(
    {
      order_reference: orderReference,
      ...patch,
    },
    { onConflict: "order_reference" }
  )
}

async function ensurePaidGrant(sb: any, orderReference: string) {
  const { data: ord } = await sb
    .from("billing_orders")
    .select("device_hash,plan_id")
    .eq("order_reference", orderReference)
    .maybeSingle()

  const deviceHash = String((ord as any)?.device_hash || "")
  const planId = String((ord as any)?.plan_id || "monthly")

  if (!deviceHash) return { ok: false, reason: "no_device_hash" }

  const nowIso = new Date().toISOString()

  const { data: existing } = await sb
    .from("access_grants")
    .select("id,paid_until")
    .eq("device_hash", deviceHash)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  const nextPaidUntil = addMonthsFromIso(existing?.paid_until ? String(existing.paid_until) : null, planId === "monthly" ? 1 : 1)

  if (existing?.id) {
    await sb
      .from("access_grants")
      .update({ paid_until: nextPaidUntil, trial_questions_left: 0, updated_at: nowIso })
      .eq("id", existing.id)
  } else {
    await sb.from("access_grants").insert({
      id: crypto.randomUUID(),
      user_id: null,
      device_hash: deviceHash,
      trial_questions_left: 0,
      paid_until: nextPaidUntil,
      promo_until: null,
      created_at: nowIso,
      updated_at: nowIso,
    })
  }

  return { ok: true, deviceHash, planId, paidUntil: nextPaidUntil }
}

async function handler(req: NextRequest) {
  const url = new URL(req.url)

  const orderReference =
    (url.searchParams.get("orderReference") || "").trim() ||
    (req.cookies.get("ta_last_order")?.value || "").trim()

  if (!orderReference) {
    return NextResponse.json({ ok: false, error: "orderReference is required" }, { status: 400 })
  }

  const sb = supabaseAdmin()
  const { httpOk, httpStatus, json } = await wayforpayCheckStatus(orderReference)

  const txStatus = String(json?.transactionStatus || json?.status || "").trim()
  const state = normalizeStatus(txStatus)

  try {
    await upsertBillingOrder(sb, orderReference, {
      status: state,
      currency: json?.currency || null,
      amount: typeof json?.amount === "number" ? json.amount : Number(json?.amount || 0) || null,
      raw: json || null,
      updated_at: new Date().toISOString(),
    })
  } catch {}

  let grant: any = null
  if (state === "paid") {
    try {
      grant = await ensurePaidGrant(sb, orderReference)
    } catch {}
  }

  return NextResponse.json(
    {
      ok: state === "paid",
      orderReference,
      state,
      transactionStatus: txStatus || null,
      httpOk,
      httpStatus,
      grant,
      wayforpay: json || null,
    },
    { status: 200, headers: { "cache-control": "no-store" } }
  )
}

export async function GET(req: NextRequest) {
  return handler(req)
}

export async function POST(req: NextRequest) {
  return handler(req)
}
