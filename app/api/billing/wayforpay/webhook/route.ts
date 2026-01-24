import { NextRequest, NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase-admin"
import { makeServiceWebhookSignature, makeServiceResponseSignature } from "@/lib/wayforpay"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type BillingStatus = "paid" | "failed" | "processing" | "invoice_created"

function parseJsonOrForm(text: string): any {
  if (!text) return {}
  try {
    const j = JSON.parse(text)
    if (j && typeof j === "object") return j
  } catch {}

  try {
    const params = new URLSearchParams(text)
    const obj: any = {}
    params.forEach((v, k) => {
      obj[k] = v
    })
    return obj
  } catch {}

  return {}
}

function toLower(v: any) {
  return String(v ?? "").trim().toLowerCase()
}

function mapTxStatusToBillingStatus(txStatusRaw: any): BillingStatus {
  const s = toLower(txStatusRaw)

  if (s === "approved" || s === "paid" || s === "success") return "paid"
  if (s === "inprocessing" || s === "processing" || s === "pending") return "processing"
  if (s === "created" || s === "invoice_created") return "invoice_created"

  // declined / expired / refunded / reversed / chargeback / unknown
  return "failed"
}

function toDateOrNull(v: any): Date | null {
  if (!v) return null
  const d = new Date(String(v))
  if (Number.isNaN(d.getTime())) return null
  return d
}

function addDays(base: Date, days: number): Date {
  const d = new Date(base)
  d.setDate(d.getDate() + days)
  return d
}

async function extendPaidUntil(admin: any, userId: string, days: number) {
  const nowIso = new Date().toISOString()

  // читаем текущий paid_until из profiles
  const { data: prof } = await admin
    .from("profiles")
    .select("paid_until,promo_until,auto_renew,autorenew,subscription_status")
    .eq("id", userId)
    .maybeSingle()

  const currentPaid = toDateOrNull(prof?.paid_until)
  const base = currentPaid && currentPaid.getTime() > Date.now() ? currentPaid : new Date()
  const nextPaidUntil = addDays(base, days).toISOString()

  // обновляем profiles разными вариантами полей
  const payloadVariants = [
    { paid_until: nextPaidUntil, auto_renew: true, subscription_status: "active", updated_at: nowIso },
    { paid_until: nextPaidUntil, autorenew: true, subscription_status: "active", updated_at: nowIso },
    { paid_until: nextPaidUntil, auto_renew: true, subscription_status: "active" },
    { paid_until: nextPaidUntil, autorenew: true, subscription_status: "active" },
  ]

  let updated = false
  for (const payload of payloadVariants) {
    const r = await admin.from("profiles").update(payload).eq("id", userId)
    if (!r?.error) {
      updated = true
      break
    }
  }

  // дублируем paid_until в access_grants для надежности логики в агенте
  const accountKey = `account:${userId}`
  await admin.from("access_grants").update({ paid_until: nextPaidUntil, updated_at: nowIso }).eq("user_id", userId)
  await admin.from("access_grants").update({ paid_until: nextPaidUntil, updated_at: nowIso }).eq("device_hash", accountKey)

  return { nextPaidUntil, updated }
}

export async function POST(req: NextRequest) {
  const text = await req.text()
  const payload = parseJsonOrForm(text)

  const orderReference = String(payload?.orderReference ?? payload?.order_reference ?? "").trim()
  const merchantAccount = String(payload?.merchantAccount ?? "").trim()
  const amount = payload?.amount ?? null
  const currency = payload?.currency ?? null
  const txStatus = payload?.transactionStatus ?? payload?.transaction_status ?? null

  const secretKey =
    process.env.WAYFORPAY_SECRET_KEY ||
    process.env.WFP_SECRET_KEY ||
    ""

  const expectedSignature = secretKey ? makeServiceWebhookSignature(secretKey, payload) : ""
  const gotSignature = String(payload?.merchantSignature ?? payload?.merchant_signature ?? "").trim()

  // если нет базовых полей, отвечаем accept, но ничего не меняем
  if (!orderReference) {
    return NextResponse.json({ ok: true })
  }

  // если есть secretKey, валидируем подпись
  if (secretKey && expectedSignature && gotSignature) {
    if (toLower(expectedSignature) !== toLower(gotSignature)) {
      console.error("[wfp][webhook] bad signature", { orderReference })
      return NextResponse.json({ ok: false, error: "bad_signature" }, { status: 403 })
    }
  }

  const admin = getSupabaseAdmin()
  const nextStatus = mapTxStatusToBillingStatus(txStatus)
  const nowIso = new Date().toISOString()

  // находим заказ
  const { data: existingRows } = await admin
    .from("billing_orders")
    .select("order_reference,user_id,status,raw,updated_at")
    .eq("order_reference", orderReference)
    .order("updated_at", { ascending: false })
    .limit(1)

  const existing = (existingRows || [])[0] as any
  const userId = existing?.user_id ?? null

  const mergedRaw = {
    ...(existing?.raw || {}),
    webhook: payload,
    webhook_received_at: nowIso,
    last_event: "webhook",
  }

  if (existing?.order_reference) {
    await admin
      .from("billing_orders")
      .update({ status: nextStatus, raw: mergedRaw, updated_at: nowIso })
      .eq("order_reference", orderReference)
  } else {
    await admin
      .from("billing_orders")
      .insert({
        order_reference: orderReference,
        user_id: userId,
        status: nextStatus,
        raw: mergedRaw,
        amount: amount ? Number(amount) : null,
        currency: currency ? String(currency) : null,
      } as any)
  }

  // если оплата успешна и user_id известен, продлеваем доступ
  if (nextStatus === "paid" && userId) {
    await extendPaidUntil(admin, String(userId), 30)
  }

  // правильный ответ WayForPay, чтобы не было ретраев
  const status = "accept"
  const time = Math.floor(Date.now() / 1000)
  const signature = secretKey ? makeServiceResponseSignature(secretKey, orderReference, status, time) : ""

  return NextResponse.json({
    orderReference,
    status,
    time,
    signature,
    ok: true,
    merchantAccount,
    nextStatus,
  })
}
