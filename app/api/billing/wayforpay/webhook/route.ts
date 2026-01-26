import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { getSupabaseAdmin } from "@/lib/supabase-admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * WayForPay serviceUrl callback
 *
 * Входящая подпись (merchantSignature):
 * merchantAccount;orderReference;amount;currency;authCode;cardPan;transactionStatus;reasonCode
 *
 * Ответ магазина ОБЯЗАТЕЛЬНО:
 * { orderReference, status:"accept", time, signature }
 * signature = HMAC_MD5(secretKey, "orderReference;status;time")
 */

function pickEnv(...keys: string[]) {
  for (const k of keys) {
    const v = String(process.env[k] || "").trim()
    if (v) return v
  }
  return ""
}

// ✅ ВАЖНО: берём секрет из тех переменных, которые реально есть на Vercel
const SECRET_KEY = pickEnv(
  "WAYFORPAY_SECRET_KEY",
  "WAYFORPAY_MERCHANT_SECRET_KEY",
  "WFP_SECRET_KEY",
  "MERCHANT_SECRET_KEY"
)

function hmacMd5(secret: string, str: string) {
  return crypto.createHmac("md5", secret).update(str, "utf8").digest("hex")
}

function s(v: any) {
  return v === undefined || v === null ? "" : String(v)
}

async function readAnyBody(req: NextRequest) {
  const raw = await req.text().catch(() => "")
  if (!raw) return { body: null, raw: "" }

  // JSON
  try {
    const j = JSON.parse(raw)
    return { body: j, raw }
  } catch {}

  // x-www-form-urlencoded
  try {
    const sp = new URLSearchParams(raw)
    const obj: any = {}
    for (const [k, v] of sp.entries()) {
      if (k.endsWith("[]")) {
        const kk = k.slice(0, -2)
        if (!Array.isArray(obj[kk])) obj[kk] = []
        obj[kk].push(v)
      } else {
        obj[k] = v
      }
    }
    return { body: obj, raw }
  } catch {}

  return { body: { raw }, raw }
}

function toDateOrNull(v: any): Date | null {
  if (!v) return null
  const d = new Date(String(v))
  if (Number.isNaN(d.getTime())) return null
  return d
}

function addDays(base: Date, days: number) {
  const d = new Date(base)
  d.setDate(d.getDate() + days)
  return d
}

// ✅ выдаём доступ сразу в webhook
async function activatePaid(
  admin: any,
  opts: { userId?: string | null; deviceHash?: string | null; days: number }
) {
  const now = new Date()
  const nowIso = now.toISOString()

  const userId = opts.userId || null
  const deviceHash = opts.deviceHash || null

  const calcNext = (current: any) => {
    const currentPaid = toDateOrNull(current?.paid_until)
    const base = currentPaid && currentPaid.getTime() > now.getTime() ? currentPaid : now
    return addDays(base, opts.days).toISOString()
  }

  let nextPaidUntil: string | null = null

  // 1) по user_id
  if (userId) {
    const { data: existing } = await admin
      .from("access_grants")
      .select("id, paid_until")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle()

    const paidUntil = calcNext(existing)
    nextPaidUntil = paidUntil

    if (existing?.id) {
      await admin
        .from("access_grants")
        .update({
          paid_until: paidUntil,
          trial_questions_left: 0,
          updated_at: nowIso,
        } as any)
        .eq("id", existing.id)
    } else {
      await admin.from("access_grants").insert({
        id: crypto.randomUUID(),
        user_id: userId,
        device_hash: null,
        trial_questions_left: 0,
        paid_until: paidUntil,
        promo_until: null,
        created_at: nowIso,
        updated_at: nowIso,
      } as any)
    }

    // profiles
    try {
      await admin
        .from("profiles")
        .update({
          paid_until: paidUntil,
          subscription_status: "active",
          updated_at: nowIso,
        } as any)
        .eq("id", userId)
    } catch {}
  }

  // 2) по device_hash (гостевой сценарий)
  if (deviceHash) {
    const { data: existingDev } = await admin
      .from("access_grants")
      .select("id, paid_until")
      .eq("device_hash", deviceHash)
      .limit(1)
      .maybeSingle()

    const paidUntilDev = calcNext(existingDev)
    if (!nextPaidUntil) nextPaidUntil = paidUntilDev

    if (existingDev?.id) {
      await admin
        .from("access_grants")
        .update({
          paid_until: paidUntilDev,
          trial_questions_left: 0,
          updated_at: nowIso,
        } as any)
        .eq("id", existingDev.id)
    } else {
      await admin.from("access_grants").insert({
        id: crypto.randomUUID(),
        user_id: null,
        device_hash: deviceHash,
        trial_questions_left: 0,
        paid_until: paidUntilDev,
        promo_until: null,
        created_at: nowIso,
        updated_at: nowIso,
      } as any)
    }
  }

  return { paid_until: nextPaidUntil }
}

export async function POST(req: NextRequest) {
  const admin = getSupabaseAdmin()
  const nowIso = new Date().toISOString()

  const { body, raw } = await readAnyBody(req)
  const b: any = body || {}

  const merchantAccount = s(b.merchantAccount).trim()
  const orderReference = s(b.orderReference).trim()
  const amount = s(b.amount).trim()
  const currency = s(b.currency).trim()
  const authCode = s(b.authCode).trim()
  const cardPan = s(b.cardPan).trim()
  const transactionStatus = s(b.transactionStatus).trim()
  const reasonCode = s(b.reasonCode || b.reason || "").trim()
  const incomingSignature = s(b.merchantSignature).trim().toLowerCase()

  // ✅ Проверка подписи входящего callback
  let signatureOk = false
  if (SECRET_KEY) {
    const signStr = [
      merchantAccount,
      orderReference,
      amount,
      currency,
      authCode,
      cardPan,
      transactionStatus,
      reasonCode,
    ].join(";")
    const expected = hmacMd5(SECRET_KEY, signStr).toLowerCase()
    signatureOk = expected === incomingSignature
  }

  // Маппинг статуса
  const ts = transactionStatus.toLowerCase()
  let status = "pending"
  if (ts === "approved" || ts === "successful") status = "paid"
  if (ts === "declined") status = "failed"
  if (ts === "refunded") status = "refunded"

  // Если orderReference пустой — всё равно отвечаем accept, чтобы WFP не долбил ретраями
  if (!orderReference) {
    const time = Math.floor(Date.now() / 1000)
    const respStatus = "accept"
    const respSignStr = `;${respStatus};${time}`
    const respSignature = SECRET_KEY ? hmacMd5(SECRET_KEY, respSignStr) : ""
    return NextResponse.json({ status: "accept", time, signature: respSignature }, { status: 200 })
  }

  // 1) берём существующий заказ (там user_id/device_hash)
  let orderUserId: string | null = null
  let orderDeviceHash: string | null = null
  let planId: string | null = null
  let prevRaw: any = null

  try {
    const { data: existing } = await admin
      .from("billing_orders")
      .select("user_id, device_hash, plan_id, raw")
      .eq("order_reference", orderReference)
      .limit(1)
      .maybeSingle()

    orderUserId = String(existing?.user_id || "").trim() || null
    orderDeviceHash = String(existing?.device_hash || "").trim() || null
    planId = String(existing?.plan_id || "").trim() || null
    prevRaw = existing?.raw || null
  } catch {}

  // 2) апдейт заказа (НЕ затираем raw полностью)
  try {
    const mergedRaw = {
      ...(prevRaw && typeof prevRaw === "object" ? prevRaw : {}),
      callback: b,
      callback_raw: raw,
      last_callback_at: nowIso,
      signature_ok: signatureOk,
    }

    await admin
      .from("billing_orders")
      .update({
        status,
        raw: mergedRaw,
        amount: Number(amount || 0) || null,
        currency: currency || null,
        updated_at: nowIso,
      } as any)
      .eq("order_reference", orderReference)
  } catch {
    // если апдейт не прошёл — пробуем вставить минимум
    try {
      await admin.from("billing_orders").insert({
        order_reference: orderReference,
        status,
        raw: { callback: b, callback_raw: raw, created_at: nowIso, signature_ok: signatureOk },
        amount: Number(amount || 0) || null,
        currency: currency || null,
        created_at: nowIso,
        updated_at: nowIso,
      } as any)
    } catch {}
  }

  // ✅ 3) если paid — выдаём доступ сразу тут
  let activatedPaidUntil: string | null = null
  if (status === "paid") {
    // если device_hash не нашли — попробуем взять из raw заказа (из purchase)
    if (!orderDeviceHash && prevRaw?.deviceHash) {
      orderDeviceHash = String(prevRaw.deviceHash || "").trim() || null
    }

    const days = planId === "monthly" || !planId ? 30 : 30
    try {
      const activated = await activatePaid(admin, {
        userId: orderUserId,
        deviceHash: orderDeviceHash,
        days,
      })
      activatedPaidUntil = activated?.paid_until || null
    } catch {}
  }

  // 4) ОТВЕТ WAYFORPAY: accept + signature(orderReference;status;time)
  const time = Math.floor(Date.now() / 1000)
  const respStatus = "accept"
  const respSignStr = `${orderReference};${respStatus};${time}`
  const respSignature = SECRET_KEY ? hmacMd5(SECRET_KEY, respSignStr) : ""

  return NextResponse.json(
    {
      orderReference,
      status: respStatus,
      time,
      signature: respSignature,
      debug: {
        signatureOk,
        transactionStatus,
        mappedStatus: status,
        activatedPaidUntil,
      },
    },
    { status: 200 }
  )
}
