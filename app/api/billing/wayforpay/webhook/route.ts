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
  if (!raw) return { body: null as any, raw: "" }

  // JSON
  try {
    const j = JSON.parse(raw)
    return { body: j, raw }
  } catch {}

  // x-www-form-urlencoded (БЕЗ for..of entries, чтобы не ломать сборку)
  try {
    const sp = new URLSearchParams(raw)
    const obj: any = {}
    sp.forEach((v, k) => {
      if (k.endsWith("[]")) {
        const kk = k.slice(0, -2)
        if (!Array.isArray(obj[kk])) obj[kk] = []
        obj[kk].push(v)
      } else {
        obj[k] = v
      }
    })
    return { body: obj, raw }
  } catch {}

  return { body: { raw }, raw }
}

function mapStatus(transactionStatus: string) {
  const ts = String(transactionStatus || "").toLowerCase()
  if (ts === "approved" || ts === "successful") return "paid"
  if (ts === "declined") return "failed"
  if (ts === "refunded") return "refunded"
  return "pending"
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

async function activatePaid(
  admin: any,
  opts: { userId?: string | null; deviceHash?: string | null; days: number }
) {
  const now = new Date()
  const nowIso = now.toISOString()

  const userId = opts.userId || null
  const deviceHash = opts.deviceHash || null

  const calcNextIso = async (currentPaidUntil: any) => {
    const current = toDateOrNull(currentPaidUntil)
    const base = current && current.getTime() > now.getTime() ? current : now
    return addDays(base, opts.days).toISOString()
  }

  let paidUntilFinal: string | null = null

  // 1) user_id (если есть)
  if (userId) {
    const { data: existing, error: e1 } = await admin
      .from("access_grants")
      .select("paid_until")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle()

    if (e1) console.error("access_grants select user_id error:", e1)

    const paidUntil = await calcNextIso(existing?.paid_until)
    paidUntilFinal = paidUntil

    const { error: e2 } = await admin
      .from("access_grants")
      .upsert(
        {
          user_id: userId,
          device_hash: null,
          trial_questions_left: 0,
          paid_until: paidUntil,
          promo_until: null,
          updated_at: nowIso,
          created_at: nowIso,
        } as any,
        { onConflict: "user_id" }
      )

    if (e2) console.error("access_grants upsert user_id error:", e2)

    // profiles (для UI / summary)
    const { error: e3 } = await admin
      .from("profiles")
      .update({
        paid_until: paidUntil,
        subscription_status: "active",
        updated_at: nowIso,
      } as any)
      .eq("id", userId)

    if (e3) console.error("profiles update paid_until error:", e3)
  }

  // 2) device_hash (гостевой сценарий)
  if (deviceHash) {
    const { data: existingDev, error: e4 } = await admin
      .from("access_grants")
      .select("paid_until")
      .eq("device_hash", deviceHash)
      .limit(1)
      .maybeSingle()

    if (e4) console.error("access_grants select device_hash error:", e4)

    const paidUntilDev = await calcNextIso(existingDev?.paid_until)
    if (!paidUntilFinal) paidUntilFinal = paidUntilDev

    const { error: e5 } = await admin
      .from("access_grants")
      .upsert(
        {
          user_id: null,
          device_hash: deviceHash,
          trial_questions_left: 0,
          paid_until: paidUntilDev,
          promo_until: null,
          updated_at: nowIso,
          created_at: nowIso,
        } as any,
        { onConflict: "device_hash" }
      )

    if (e5) console.error("access_grants upsert device_hash error:", e5)
  }

  return { paid_until: paidUntilFinal }
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

  const mappedStatus = mapStatus(transactionStatus)

  // Если orderReference пустой — отвечаем accept, чтобы WFP не долбил ретраями
  if (!orderReference) {
    const time0 = Math.floor(Date.now() / 1000)
    const respStatus0 = "accept"
    const respSignature0 = SECRET_KEY ? hmacMd5(SECRET_KEY, `;${respStatus0};${time0}`) : ""
    return NextResponse.json(
      { status: "accept", time: time0, signature: respSignature0 },
      { status: 200 }
    )
  }

  // 1) Получаем заказ (там user_id / device_hash / plan_id / raw)
  let orderUserId: string | null = null
  let orderDeviceHash: string | null = null
  let planId: string | null = null
  let prevRaw: any = null

  const { data: existingOrder, error: eOrder } = await admin
    .from("billing_orders")
    .select("user_id, device_hash, plan_id, raw")
    .eq("order_reference", orderReference)
    .limit(1)
    .maybeSingle()

  if (eOrder) console.error("billing_orders select error:", eOrder)

  orderUserId = String(existingOrder?.user_id || "").trim() || null
  orderDeviceHash = String(existingOrder?.device_hash || "").trim() || null
  planId = String(existingOrder?.plan_id || "").trim() || null
  prevRaw = existingOrder?.raw || null

  // 2) Сохраняем callback в billing_orders (upsert)
  const mergedRaw = {
    ...(prevRaw && typeof prevRaw === "object" ? prevRaw : {}),
    callback: b,
    callback_raw: raw,
    last_callback_at: nowIso,
    signature_ok: signatureOk,
    transactionStatus,
    mappedStatus,
  }

  const { error: eUpsert } = await admin
    .from("billing_orders")
    .upsert(
      {
        order_reference: orderReference,
        status: mappedStatus,
        raw: mergedRaw,
        amount: Number(amount || 0) || null,
        currency: currency || null,
        updated_at: nowIso,
        created_at: nowIso,
      } as any,
      { onConflict: "order_reference" }
    )

  if (eUpsert) console.error("billing_orders upsert error:", eUpsert)

  // ✅ 3) Если paid — выдаём доступ сразу тут
  let activatedPaidUntil: string | null = null
  if (mappedStatus === "paid") {
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
    } catch (e: any) {
      console.error("activatePaid error:", e?.message || e)
    }
  }

  // 4) ОТВЕТ WAYFORPAY: accept + signature(orderReference;status;time)
  const time = Math.floor(Date.now() / 1000)
  const respStatus = "accept"
  const respSignStr = `${orderReference};${respStatus};${time}`
  const respSignature = SECRET_KEY ? hmacMd5(SECRET_KEY, respSignStr) : ""

  console.log("WFP webhook:", {
    orderReference,
    transactionStatus,
    mappedStatus,
    signatureOk,
    orderUserId,
    orderDeviceHash,
    activatedPaidUntil,
  })

  return NextResponse.json(
    {
      orderReference,
      status: respStatus,
      time,
      signature: respSignature,
      debug: {
        signatureOk,
        transactionStatus,
        mappedStatus,
        activatedPaidUntil,
      },
    },
    { status: 200 }
  )
}
