import { NextResponse } from "next/server"
import crypto, { createHmac } from "crypto"
import { createClient } from "@supabase/supabase-js"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

function hmacMd5HexUpper(str: string, key: string) {
  return createHmac("md5", key).update(str, "utf8").digest("hex").toUpperCase()
}

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

function normalizeAmount(v: any): string {
  const n = Number(v)
  if (Number.isFinite(n)) return n.toFixed(2)
  const s = String(v ?? "").trim()
  if (!s) return ""
  const n2 = Number(s)
  if (Number.isFinite(n2)) return n2.toFixed(2)
  return s
}

function normalizeTxStatus(tx: string) {
  const s = String(tx || "").trim().toLowerCase()
  if (s === "approved") return "paid"
  if (s === "inprocessing" || s === "pending") return "processing"
  if (s === "refunded") return "refunded"
  if (s === "declined" || s === "expired" || s === "voided") return "failed"
  return s || "callback_received"
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

async function readBody(req: Request) {
  const ct = (req.headers.get("content-type") || "").toLowerCase()

  if (ct.includes("application/json")) {
    const j = await req.json().catch(() => null)
    return j && typeof j === "object" ? j : null
  }

  if (ct.includes("application/x-www-form-urlencoded") || ct.includes("multipart/form-data")) {
    const fd = await req.formData().catch(() => null)
    if (!fd) return null
    const obj: any = {}
    fd.forEach((v, k) => {
      const value = typeof v === "string" ? v : String(v)
      if (obj[k] === undefined) obj[k] = value
      else if (Array.isArray(obj[k])) obj[k].push(value)
      else obj[k] = [obj[k], value]
    })
    return obj
  }

  const txt = await req.text().catch(() => "")
  if (!txt) return null
  return { rawText: txt }
}

export async function POST(req: Request) {
  const secret = process.env.WAYFORPAY_SECRET_KEY || process.env.WFP_SECRET_KEY || ""
  const body = await readBody(req)

  const merchantAccount = String((body as any)?.merchantAccount || "")
  const orderReference = String((body as any)?.orderReference || "")
  const amountStr = normalizeAmount((body as any)?.amount)
  const currency = String((body as any)?.currency || "")
  const authCode = String((body as any)?.authCode || "")
  const cardPan = String((body as any)?.cardPan || "")
  const transactionStatusRaw = String((body as any)?.transactionStatus || "")
  const reasonCode = String((body as any)?.reasonCode || "")
  const incomingSignature = String((body as any)?.merchantSignature || "")

  let signatureOk = true
  if (secret && merchantAccount && orderReference) {
    const signString = [merchantAccount, orderReference, amountStr, currency, authCode, cardPan, transactionStatusRaw, reasonCode].join(";")
    const expected = hmacMd5HexUpper(signString, secret)
    signatureOk = expected === incomingSignature.toUpperCase()
  }

  const sb = getSupabaseAdmin()

  // 1) billing_orders
  if (sb && orderReference) {
    const normalized = normalizeTxStatus(transactionStatusRaw)
    const finalStatus = signatureOk ? normalized : "callback_signature_invalid"

    const nowIso = new Date().toISOString()
    const updatePayload: any = {
      status: finalStatus,
      raw: { ...(body as any), __normalizedStatus: normalized, __signatureOk: signatureOk },
      updated_at: nowIso,
    }

    const { error } = await sb.from("billing_orders").update(updatePayload).eq("order_reference", orderReference)

    if (error) {
      await sb.from("billing_orders").insert([
        {
          order_reference: orderReference,
          plan_id: (body as any)?.planId || "monthly",
          amount: Number(amountStr) || null,
          currency: currency || "UAH",
          status: updatePayload.status,
          raw: updatePayload.raw,
          updated_at: updatePayload.updated_at,
        },
      ]).catch(() => null)
    }
  }

  // 2) grant выдаём только если подпись ок и Approved
  const isApproved = String(transactionStatusRaw || "").trim().toLowerCase() === "approved"

  if (sb && signatureOk && isApproved && orderReference) {
    try {
      const { data: ord } = await sb
        .from("billing_orders")
        .select("device_hash,plan_id")
        .eq("order_reference", orderReference)
        .maybeSingle()

      const deviceHash = String((ord as any)?.device_hash || "")
      const planId = String((ord as any)?.plan_id || "monthly")

      if (deviceHash) {
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
            .update({
              paid_until: nextPaidUntil,
              trial_questions_left: 0,
              updated_at: nowIso,
            })
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
      }
    } catch {}
  }

  // 3) accept response
  const time = Math.floor(Date.now() / 1000)
  const status = "accept"
  const respString = `${orderReference};${status};${time}`
  const signature = secret ? hmacMd5HexUpper(respString, secret) : ""

  return NextResponse.json({
    orderReference,
    status,
    time,
    signature,
  })
}

export async function GET() {
  return NextResponse.json({ ok: true })
}
