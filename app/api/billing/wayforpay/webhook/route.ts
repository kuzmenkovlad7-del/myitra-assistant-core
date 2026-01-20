import { NextResponse } from "next/server"
import crypto from "crypto"
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

function hmacMd5(secretKey: string, s: string) {
  return crypto.createHmac("md5", secretKey).update(s).digest("hex")
}

function mapWayforpayStatus(ts: string) {
  const v = String(ts || "").toLowerCase()
  if (v.includes("approved")) return "paid"
  if (v.includes("pending") || v.includes("inprocessing") || v.includes("in_processing")) return "pending"
  if (v.includes("refunded")) return "refunded"
  if (v.includes("voided")) return "voided"
  if (v.includes("expired")) return "expired"
  return "failed"
}

function pickBestStatus(statuses: string[]) {
  const s = statuses.map((x) => String(x || "").toLowerCase())
  if (s.includes("paid")) return "paid"
  if (s.includes("pending")) return "pending"
  if (s.includes("refunded")) return "refunded"
  if (s.includes("voided")) return "voided"
  if (s.includes("expired")) return "expired"
  return "failed"
}

function buildAcceptResponse(orderReference: string, secretKey: string) {
  const time = Math.floor(Date.now() / 1000)
  const status = "accept"
  const sign = hmacMd5(secretKey, [orderReference, status, String(time)].join(";"))
  return { orderReference, status, time, signature: sign }
}

function addDays(from: Date, days: number) {
  const d = new Date(from)
  d.setDate(d.getDate() + days)
  return d
}

async function readPayload(req: Request) {
  // WayForPay может прислать JSON или form-urlencoded
  const ct = String(req.headers.get("content-type") || "").toLowerCase()

  if (ct.includes("application/json")) {
    const j = await req.json().catch(() => ({} as any))
    return j || {}
  }

  const text = await req.text().catch(() => "")
  if (!text) return {}

  // пробуем JSON
  try {
    const j = JSON.parse(text)
    if (j && typeof j === "object") return j
  } catch {}

  // пробуем form-urlencoded
  try {
    const params = new URLSearchParams(text)
    const obj: any = {}
    for (const [k, v] of params.entries()) obj[k] = v
    return obj
  } catch {}

  return {}
}

export async function POST(req: Request) {
  const secretKey = String(process.env.WAYFORPAY_SECRET_KEY ?? "").trim()
  if (!secretKey) return NextResponse.json({ ok: false, error: "Missing WAYFORPAY_SECRET_KEY" }, { status: 500 })

  const payload = await readPayload(req)

  const orderReference = String(payload?.orderReference ?? "")
  const merchantAccount = String(payload?.merchantAccount ?? "")
  const amount = String(payload?.amount ?? "")
  const currency = String(payload?.currency ?? "")
  const authCode = String(payload?.authCode ?? "")
  const cardPan = String(payload?.cardPan ?? "")
  const transactionStatus = String(payload?.transactionStatus ?? "")
  const reasonCode = String(payload?.reasonCode ?? "")

  const signatureIncoming = String(payload?.merchantSignature ?? payload?.signature ?? "")

  // стандартная строка подписи callback
  const signStr = [merchantAccount, orderReference, amount, currency, authCode, cardPan, transactionStatus, reasonCode].join(";")
  const signatureExpected = hmacMd5(secretKey, signStr)
  const signatureOk = !!signatureIncoming && signatureIncoming === signatureExpected

  if (!signatureOk) {
    console.warn("[billing][webhook] signature mismatch", { orderReference })
  }

  const nextStatus = mapWayforpayStatus(transactionStatus)
  const admin = getSupabaseAdmin()

  // достаём последние записи по order_reference
  const existing = await admin
    .from("billing_orders")
    .select("status,raw,updated_at,user_id,plan_id,amount,currency,order_reference")
    .eq("order_reference", orderReference)
    .order("updated_at", { ascending: false })
    .limit(10)

  const existingStatuses = (existing.data || []).map((r: any) => String(r.status || ""))
  const bestExisting = pickBestStatus(existingStatuses)

  const latestRaw = (existing.data?.[0] as any)?.raw || {}
  const mergedRaw = {
    ...(latestRaw || {}),
    webhook: payload,
    webhook_received_at: new Date().toISOString(),
  }

  if ((existing.data || []).length === 0) {
    // если вдруг заказа не было в БД, создаём как можем
    await admin.from("billing_orders").insert({
      order_reference: orderReference,
      status: nextStatus,
      amount: Number(payload?.amount ?? 0) || null,
      currency: currency || null,
      raw: mergedRaw,
    })
  } else {
    await admin
      .from("billing_orders")
      .update({ status: nextStatus, raw: mergedRaw, updated_at: new Date().toISOString() })
      .eq("order_reference", orderReference)
  }

  // продлеваем доступ ТОЛЬКО если это первый paid
  const isFirstPaid = nextStatus === "paid" && bestExisting !== "paid"

  if (isFirstPaid) {
    const rowWithUser = (existing.data || []).find((r: any) => r?.user_id) || null
    const userId = rowWithUser?.user_id || null

    if (userId) {
      const days = Number(process.env.BILLING_MONTHLY_DAYS ?? "30") || 30

      const prof = await admin.from("profiles").select("paid_until").eq("id", userId).maybeSingle()
      const cur = (prof.data as any)?.paid_until ? new Date((prof.data as any).paid_until) : null
      const base = cur && !Number.isNaN(cur.getTime()) && cur.getTime() > Date.now() ? cur : new Date()
      const paidUntil = addDays(base, days).toISOString()

      const recToken = payload?.recToken ? String(payload.recToken) : null

      const upd = await admin
        .from("profiles")
        .update({
          paid_until: paidUntil,
          auto_renew: true,
          subscription_status: "active",
          wfp_order_reference: orderReference,
          ...(recToken ? { wfp_rec_token: recToken } : {}),
        })
        .eq("id", userId)

      if (upd.error) {
        console.error("[billing][webhook] profiles update error", { userId, orderReference, error: upd.error })
      } else {
        console.info("[billing][webhook] profile updated", { orderReference, userId, paid_until: paidUntil })
      }
    } else {
      console.warn("[billing][webhook] paid but no user_id in billing_orders", { orderReference })
    }
  }

  return NextResponse.json(buildAcceptResponse(orderReference, secretKey))
}
