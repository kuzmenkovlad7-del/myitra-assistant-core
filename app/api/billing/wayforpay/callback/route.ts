import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function pickEnv(...keys: string[]) {
  for (const k of keys) {
    const v = process.env[k]
    if (v && String(v).trim()) return String(v).trim()
  }
  return ""
}

function safeJsonParse(s: string) {
  try {
    return JSON.parse(s)
  } catch {
    return null
  }
}

async function readAnyBody(req: NextRequest): Promise<any> {
  const ct = (req.headers.get("content-type") || "").toLowerCase()

  if (ct.includes("application/json")) {
    try {
      return await req.json()
    } catch {
      return {}
    }
  }

  const text = await req.text()

  const j = safeJsonParse(text)
  if (j) return j

  // application/x-www-form-urlencoded (WayForPay часто так шлёт)
  const params = new URLSearchParams(text)
  const out: any = {}
  params.forEach((v, k) => {
    out[k] = v
  })

  // Иногда WFP присылает поле response как JSON строку
  if (typeof out.response === "string") {
    const jr = safeJsonParse(out.response)
    if (jr) return jr
  }

  return out
}

function hmacMd5(secret: string, parts: Array<string | number>) {
  const s = parts.map((x) => String(x)).join(";")
  return crypto.createHmac("md5", secret).update(s).digest("hex")
}

function isApproved(tx: string) {
  const v = String(tx || "").toLowerCase()
  return v === "approved" || v === "accept" || v === "success" || v === "paid"
}

function addDaysIso(days: number) {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString()
}

function makeSupabaseAdmin() {
  const url =
    pickEnv("NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL") || ""
  const serviceKey =
    pickEnv("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_KEY") || ""

  if (!url || !serviceKey) return null
  return createClient(url, serviceKey, { auth: { persistSession: false } })
}

export async function POST(req: NextRequest) {
  const body = await readAnyBody(req)

  console.log("[WFP CALLBACK] headers:", {
    ct: req.headers.get("content-type"),
    ua: req.headers.get("user-agent"),
    ip: req.headers.get("x-forwarded-for"),
  })
  console.log("[WFP CALLBACK] incoming body:", body)

  const orderReference =
    String(
      body?.orderReference ||
      body?.order_reference ||
      body?.invoice?.orderReference ||
      ""
    ) || ""

  const transactionStatus =
    String(
      body?.transactionStatus ||
      body?.status ||
      body?.invoiceStatus ||
      ""
    ) || ""

  const amount = body?.amount ?? body?.orderAmount ?? null
  const currency = body?.currency ?? body?.orderCurrency ?? null

  if (!orderReference) {
    console.log("[WFP CALLBACK] missing orderReference, cannot confirm")
    return NextResponse.json(
      { ok: false, error: "missing orderReference" },
      { status: 400, headers: { "cache-control": "no-store" } }
    )
  }

  // 1) Пытаемся обновить БД (если есть service role)
  const supabase = makeSupabaseAdmin()
  if (!supabase) {
    console.log("[WFP CALLBACK] supabase admin is not configured (missing SUPABASE_SERVICE_ROLE_KEY or URL)")
  } else {
    try {
      const ord = await supabase
        .from("billing_orders")
        .select("order_reference, device_hash, plan_id, user_id")
        .eq("order_reference", orderReference)
        .maybeSingle()

      if (ord.error) {
        console.log("[WFP CALLBACK] billing_orders select error:", ord.error)
      }

      const deviceHash = ord.data?.device_hash || null
      const planId = ord.data?.plan_id || "monthly"

      const paid = isApproved(transactionStatus)
      const newStatus = paid ? "paid" : (transactionStatus ? String(transactionStatus).toLowerCase() : "unknown")

      const up = await supabase
        .from("billing_orders")
        .update({
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("order_reference", orderReference)

      if (up.error) {
        console.log("[WFP CALLBACK] billing_orders update error:", up.error)
      } else {
        console.log("[WFP CALLBACK] billing_orders updated:", { orderReference, status: newStatus })
      }

      // доступ по device_hash
      if (paid && deviceHash) {
        const paidUntil = planId === "monthly" ? addDaysIso(30) : addDaysIso(30)

        // upsert-like: пробуем update, если не обновило строк — вставим
        const upd = await supabase
          .from("access_grants")
          .update({
            plan_id: planId,
            paid_until: paidUntil,
            updated_at: new Date().toISOString(),
          })
          .eq("device_hash", deviceHash)

        if (upd.error) {
          console.log("[WFP CALLBACK] access_grants update error:", upd.error)
        } else {
          // если 0 строк обновлено — вставим
          // supabase-js не даёт rowsAffected стабильно, поэтому просто пробуем insert, он может упасть по unique — это ок
          const ins = await supabase
            .from("access_grants")
            .insert({
              device_hash: deviceHash,
              plan_id: planId,
              paid_until: paidUntil,
            })

          if (ins.error) {
            // если unique constraint — это нормально, значит update уже сработал
            console.log("[WFP CALLBACK] access_grants insert result:", ins.error?.message || ins.error)
          } else {
            console.log("[WFP CALLBACK] access_grants inserted:", { deviceHash, paidUntil, planId })
          }
        }

        console.log("[WFP CALLBACK] access granted:", { deviceHash, paidUntil, planId })
      } else {
        console.log("[WFP CALLBACK] not granting access:", { paid, deviceHash })
      }
    } catch (e: any) {
      console.log("[WFP CALLBACK] db update failed:", String(e?.message || e))
    }
  }

  // 2) Отвечаем WayForPay accept (иначе будет откат/неподтверждение)
  const secret = pickEnv(
    "WAYFORPAY_MERCHANT_SECRET_KEY",
    "WAYFORPAY_SECRET_KEY",
    "WAYFORPAY_SECRET",
    "WFP_SECRET"
  )

  if (!secret) {
    console.log("[WFP CALLBACK] MISSING WAYFORPAY SECRET env, cannot sign accept response")
    return NextResponse.json(
      { ok: false, error: "Missing WayForPay secret env (WAYFORPAY_MERCHANT_SECRET_KEY / WAYFORPAY_SECRET_KEY)" },
      { status: 500, headers: { "cache-control": "no-store" } }
    )
  }

  const status = "accept"
  const time = Math.floor(Date.now() / 1000).toString()
  const signature = hmacMd5(secret, [orderReference, status, time])

  console.log("[WFP CALLBACK] responding accept:", { orderReference, status, time })

  return NextResponse.json(
    { orderReference, status, time, signature },
    { status: 200, headers: { "cache-control": "no-store" } }
  )
}

export async function GET() {
  return NextResponse.json(
    { ok: true },
    { status: 200, headers: { "cache-control": "no-store" } }
  )
}
