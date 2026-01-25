import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import { getSupabaseAdmin } from "@/lib/supabase-admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type BillingStatus = "paid" | "failed" | "processing" | "invoice_created" | "not_found"

function toLower(v: any) {
  return String(v ?? "").trim().toLowerCase()
}

function normalizeRowStatus(s: any): BillingStatus {
  const v = toLower(s)
  if (!v) return "not_found"
  if (v === "paid") return "paid"
  if (v === "processing") return "processing"
  if (v === "invoice_created") return "invoice_created"
  if (v === "created") return "invoice_created"
  if (v === "failed") return "failed"
  return "failed"
}

function pickBestStatus(statuses: BillingStatus[]): BillingStatus {
  if (statuses.includes("paid")) return "paid"
  if (statuses.includes("processing")) return "processing"
  if (statuses.includes("invoice_created")) return "invoice_created"
  if (statuses.length === 0) return "not_found"
  return "failed"
}

function hmacMd5(str: string, key: string) {
  return crypto.createHmac("md5", key).update(str, "utf8").digest("hex")
}

function mapWayforpayTxToStatus(txStatus?: string | null): BillingStatus {
  const s = toLower(txStatus)
  if (s === "approved" || s === "paid" || s === "success" || s === "successful") return "paid"
  if (s === "inprocessing" || s === "processing" || s === "pending") return "processing"
  if (s === "created") return "invoice_created"
  return "failed"
}

async function getUserIdFromSession() {
  const url = String(process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim()
  const anon = String(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim()
  if (!url || !anon) return null

  const cookieStore = cookies()
  const sb = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll() {},
    },
  })

  const { data } = await sb.auth.getUser().catch(() => ({ data: null as any }))
  return data?.user?.id ? String(data.user.id) : null
}

async function wayforpayCheck(orderReference: string) {
  const merchantAccount =
    process.env.WAYFORPAY_MERCHANT_ACCOUNT ||
    process.env.WFP_MERCHANT_ACCOUNT ||
    ""

  const secretKey =
    process.env.WAYFORPAY_SECRET_KEY ||
    process.env.WFP_SECRET_KEY ||
    ""

  if (!merchantAccount || !secretKey) {
    return { ok: false as const, error: "missing_wayforpay_env" as const }
  }

  const signStr = `${merchantAccount};${orderReference}`
  const merchantSignature = hmacMd5(signStr, secretKey)

  const requestBody = {
    transactionType: "CHECK_STATUS",
    merchantAccount,
    orderReference,
    apiVersion: 1,
    merchantSignature,
  }

  const r = await fetch("https://api.wayforpay.com/api", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
    cache: "no-store",
  })

  const json = await r.json().catch(() => null)
  if (!r.ok || !json) return { ok: false as const, error: "wayforpay_check_failed" as const }

  const txStatus = json.transactionStatus || json.status || null
  return { ok: true as const, txStatus: String(txStatus || ""), raw: json }
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

async function upsertGrant(admin: any, deviceHash: string, userId: string | null, days: number, nowIso: string) {
  const { data: existing } = await admin
    .from("access_grants")
    .select("id, paid_until")
    .eq("device_hash", deviceHash)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  const now = new Date()
  const currentPaid = toDateOrNull(existing?.paid_until)
  const base = currentPaid && currentPaid.getTime() > now.getTime() ? currentPaid : now
  const nextPaid = addDays(base, days).toISOString()

  if (existing?.id) {
    await admin
      .from("access_grants")
      .update({ user_id: userId, paid_until: nextPaid, trial_questions_left: 0, updated_at: nowIso })
      .eq("id", existing.id)
  } else {
    await admin.from("access_grants").insert({
      id: crypto.randomUUID(),
      user_id: userId,
      device_hash: deviceHash,
      trial_questions_left: 0,
      paid_until: nextPaid,
      promo_until: null,
      created_at: nowIso,
      updated_at: nowIso,
    } as any)
  }

  return nextPaid
}

async function activatePaid(admin: any, orderReference: string, userId: string | null, deviceHash: string | null) {
  const nowIso = new Date().toISOString()
  const days = 30

  if (deviceHash) {
    await upsertGrant(admin, deviceHash, null, days, nowIso).catch(() => null)
  }

  if (userId) {
    await upsertGrant(admin, `account:${userId}`, userId, days, nowIso).catch(() => null)

    await admin
      .from("profiles")
      .update({
        subscription_status: "active",
        auto_renew: true,
        wfp_order_reference: orderReference,
        updated_at: nowIso,
      } as any)
      .eq("id", userId)
      .catch(() => null)
  }
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)

  const orderReference =
    (url.searchParams.get("orderReference") ||
      url.searchParams.get("order_reference") ||
      cookies().get("ta_last_order")?.value ||
      "").trim()

  const debug = url.searchParams.get("debug") === "1"

  if (!orderReference) {
    return NextResponse.json({ ok: false, error: "missing_orderReference" }, { status: 400 })
  }

  const admin = getSupabaseAdmin()
  const nowIso = new Date().toISOString()

  // читаем из БД
  const read = await admin
    .from("billing_orders")
    .select("status, updated_at, raw, user_id, amount, currency, plan_id, device_hash, created_at")
    .eq("order_reference", orderReference)
    .order("updated_at", { ascending: false })
    .limit(20)

  if (read.error) {
    return NextResponse.json({ ok: false, error: "db_error" }, { status: 500 })
  }

  const rows = read.data || []
  const statuses = rows.map((r: any) => normalizeRowStatus(r.status))
  let best = pickBestStatus(statuses)

  const last = rows[0] as any
  const raw = last?.raw || {}

  // userId: если пусто в заказе, пробуем взять из сессии
  let userId = last?.user_id ? String(last.user_id) : null
  if (!userId) {
    userId = await getUserIdFromSession().catch(() => null)
  }

  // если не paid — проверяем в WFP и обновляем
  let txStatus: string | null =
    raw?.check?.transactionStatus ||
    raw?.webhook?.transactionStatus ||
    raw?.transactionStatus ||
    null

  if (best !== "paid") {
    const chk = await wayforpayCheck(orderReference)
    if (chk.ok) {
      txStatus = chk.txStatus || null
      const next = mapWayforpayTxToStatus(txStatus)

      const mergedRaw = {
        ...(raw || {}),
        check: chk.raw,
        check_received_at: nowIso,
        last_event: "check",
      }

      // обязательные колонки (чтобы точно не падало)
      await admin
        .from("billing_orders")
        .upsert(
          {
            order_reference: orderReference,
            user_id: userId,
            device_hash: last?.device_hash ?? raw?.deviceHash ?? null,
            plan_id: last?.plan_id ?? raw?.planId ?? "monthly",
            amount: Number(last?.amount ?? chk.raw?.amount ?? 1),
            currency: String(last?.currency ?? chk.raw?.currency ?? "UAH"),
            status: next,
            raw: mergedRaw,
            created_at: last?.created_at || nowIso,
            updated_at: nowIso,
          } as any,
          { onConflict: "order_reference" }
        )

      best = next

      if (best === "paid") {
        await activatePaid(admin, orderReference, userId, String(last?.device_hash ?? raw?.deviceHash ?? "") || null)
      }
    }
  } else {
    // paid уже есть — на всякий случай активируем доступ
    await activatePaid(admin, orderReference, userId, String(last?.device_hash ?? raw?.deviceHash ?? "") || null).catch(() => null)
  }

  const payload: any = {
    ok: true,
    orderReference,
    status: best,
    transactionStatus: txStatus,
  }

  if (debug) {
    payload.debug = {
      rows: rows.length,
      statuses,
      lastUpdatedAt: last?.updated_at || null,
      userId: userId || null,
    }
  }

  return NextResponse.json(payload)
}
