import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type AnyObj = Record<string, any>

function getSecret() {
  return (
    process.env.WAYFORPAY_SECRET_KEY ||
    process.env.WAYFORPAY_SECRET ||
    process.env.WFP_SECRET ||
    ""
  )
}

function hmacMd5(str: string, key: string) {
  return crypto.createHmac("md5", key).update(str, "utf8").digest("hex")
}

function calcRequestSignature(p: AnyObj, secret: string) {
  const signString = [
    String(p.merchantAccount ?? ""),
    String(p.orderReference ?? ""),
    String(p.amount ?? ""),
    String(p.currency ?? ""),
    String(p.authCode ?? ""),
    String(p.cardPan ?? ""),
    String(p.transactionStatus ?? ""),
    String(p.reasonCode ?? ""),
  ].join(";")

  return hmacMd5(signString, secret)
}

function calcResponseSignature(orderReference: string, status: string, time: number, secret: string) {
  const signString = `${orderReference};${status};${time}`
  return hmacMd5(signString, secret)
}

function statusToInternal(transactionStatus: string) {
  const s = (transactionStatus || "").toLowerCase()
  if (s === "approved") return "paid"
  if (s.includes("processing") || s.includes("inprocessing") || s.includes("pending")) return "pending"
  if (s.includes("declined") || s.includes("refused") || s.includes("failed")) return "failed"
  if (s.includes("expired")) return "expired"
  if (s.includes("refunded")) return "refunded"
  return transactionStatus || "unknown"
}

async function parseBody(req: NextRequest): Promise<AnyObj> {
  const ct = (req.headers.get("content-type") || "").toLowerCase()

  try {
    if (ct.includes("application/json")) {
      const j = await req.json().catch(() => ({}))
      return (j && typeof j === "object") ? j : {}
    }

    if (ct.includes("application/x-www-form-urlencoded") || ct.includes("multipart/form-data")) {
      const fd = await req.formData()
      const obj: AnyObj = {}
      // важно: НЕ используем spread / итераторы -> это и ломало сборку
      fd.forEach((v, k) => {
        obj[k] = String(v)
      })
      return obj
    }

    // fallback
    const txt = await req.text().catch(() => "")
    if (!txt) return {}
    try {
      const j = JSON.parse(txt)
      return (j && typeof j === "object") ? j : {}
    } catch {
      return { raw: txt }
    }
  } catch {
    return {}
  }
}

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ""
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  if (!url || !key) return null

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export async function GET() {
  // чтобы можно было открыть в браузере и убедиться что endpoint живой
  return NextResponse.json({ ok: true, endpoint: "wayforpay-webhook" })
}

export async function POST(req: NextRequest) {
  const secret = getSecret()
  const payload = await parseBody(req)

  const orderReference = String(payload.orderReference || "")
  const transactionStatus = String(payload.transactionStatus || "")

  console.log("✅ WFP webhook in:", {
    orderReference,
    transactionStatus,
    reason: payload.reason,
    reasonCode: payload.reasonCode,
    amount: payload.amount,
    currency: payload.currency,
  })

  if (!secret) {
    console.log("❌ WAYFORPAY secret is missing in env")
    return NextResponse.json({ ok: false, error: "Server misconfigured" }, { status: 500 })
  }

  if (!orderReference) {
    console.log("❌ Missing orderReference in webhook payload")
    return NextResponse.json({ ok: false, error: "Missing orderReference" }, { status: 400 })
  }

  // Проверяем подпись WayForPay
  const incomingSig = String(payload.merchantSignature || "")
  const expectedSig = calcRequestSignature(payload, secret)

  if (incomingSig && incomingSig !== expectedSig) {
    console.log("❌ WFP signature mismatch", { incomingSig, expectedSig })
    return NextResponse.json({ ok: false, error: "Bad signature" }, { status: 400 })
  }

  // Обновляем Supabase
  const sb = getSupabaseAdmin()
  if (!sb) {
    console.log("❌ Supabase Admin env missing (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)")
    return NextResponse.json({ ok: false, error: "Supabase misconfigured" }, { status: 500 })
  }

  const internalStatus = statusToInternal(transactionStatus)

  const { data: existing } = await sb
    .from("billing_orders")
    .select("raw")
    .eq("order_reference", orderReference)
    .maybeSingle()

  const nextRaw = {
    ...(existing?.raw || {}),
    webhook: payload,
  }

  const { error: updErr } = await sb
    .from("billing_orders")
    .update({
      status: internalStatus,
      raw: nextRaw,
      updated_at: new Date().toISOString(),
    })
    .eq("order_reference", orderReference)

  if (updErr) {
    console.log("❌ Supabase update error:", updErr)
    return NextResponse.json({ ok: false, error: "DB update failed" }, { status: 500 })
  }

  // Ответ WayForPay (важно: accept + signature)
  const time = Math.floor(Date.now() / 1000)
  const status = "accept"
  const signature = calcResponseSignature(orderReference, status, time, secret)

  return NextResponse.json({
    orderReference,
    status,
    time,
    signature,
  })
}
