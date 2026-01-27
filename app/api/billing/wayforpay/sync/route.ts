import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { randomUUID, createHash } from "crypto"

const WFP_URL = "https://api.wayforpay.com/api"

function pickEnv(name: string) {
  const v = process.env[name]
  return v && String(v).trim() ? String(v).trim() : ""
}

function mustEnv(name: string) {
  const v = pickEnv(name)
  if (!v) throw new Error("Missing env " + name)
  return v
}

function mapStatus(txStatus: string) {
  const s = String(txStatus || "").toLowerCase()
  if (s === "approved" || s === "paid") return "paid"
  if (s === "pending" || s === "inprocessing") return "pending"
  if (s === "refunded" || s === "voided") return "refunded"
  if (s === "declined" || s === "expired" || s === "refused") return "failed"
  return "unknown"
}

function merchantSignature(parts: string[], secret: string) {
  const base = parts.join(";")
  return createHash("md5").update(base + ";" + secret).digest("hex")
}

function addDaysIso(days: number) {
  const d = new Date(Date.now() + days * 24 * 60 * 60 * 1000)
  return d.toISOString()
}

function sbAdmin() {
  const url = mustEnv("NEXT_PUBLIC_SUPABASE_URL")
  const key = mustEnv("SUPABASE_SERVICE_ROLE_KEY")
  return createClient(url, key, { auth: { persistSession: false } })
}

async function upsertGrantByDeviceHash(
  sb: ReturnType<typeof sbAdmin>,
  deviceHash: string,
  paidUntilIso: string
) {
  const nowIso = new Date().toISOString()

  const existing = await sb
    .from("access_grants")
    .select("id")
    .eq("device_hash", deviceHash)
    .maybeSingle()

  if (existing.error) {
    throw new Error("access_grants select failed: " + existing.error.message)
  }

  if (existing.data?.id) {
    const upd = await sb
      .from("access_grants")
      .update({
        paid_until: paidUntilIso,
        trial_questions_left: 0,
        updated_at: nowIso,
      })
      .eq("id", existing.data.id)

    if (upd.error) throw new Error("access_grants update failed: " + upd.error.message)
    return { mode: "update", id: existing.data.id }
  }

  const ins = await sb.from("access_grants").insert({
    id: randomUUID(),
    user_id: null,
    device_hash: deviceHash,
    trial_questions_left: 0,
    paid_until: paidUntilIso,
    promo_until: null,
    created_at: nowIso,
    updated_at: nowIso,
  })

  if (ins.error) throw new Error("access_grants insert failed: " + ins.error.message)
  return { mode: "insert" }
}

async function ensurePaidGrant(sb: ReturnType<typeof sbAdmin>, orderReference: string) {
  const ord = await sb
    .from("billing_orders")
    .select("order_reference, user_id, device_hash, plan_id")
    .eq("order_reference", orderReference)
    .maybeSingle()

  if (ord.error) throw new Error("billing_orders select failed: " + ord.error.message)
  if (!ord.data) throw new Error("Order not found for orderReference")

  const planId = String(ord.data.plan_id || "monthly")
  const paidUntilIso = addDaysIso(planId === "yearly" ? 366 : 31)

  const ops: any[] = []

  if (ord.data.device_hash) {
    ops.push(await upsertGrantByDeviceHash(sb, String(ord.data.device_hash), paidUntilIso))
  }

  if (ord.data.user_id) {
    const accountKey = "account:" + String(ord.data.user_id)
    ops.push(await upsertGrantByDeviceHash(sb, accountKey, paidUntilIso))
  }

  if (!ops.length) {
    throw new Error("Order has no device_hash and no user_id, cannot grant access")
  }

  return { paidUntilIso, ops }
}

async function fetchWfpStatus(orderReference: string) {
  const merchantAccount = mustEnv("WAYFORPAY_MERCHANT_ACCOUNT")
  const secret = mustEnv("WAYFORPAY_SECRET_KEY")

  const signature = merchantSignature([merchantAccount, orderReference], secret)

  const payload = {
    transactionType: "STATUS",
    merchantAccount,
    merchantSignature: signature,
    orderReference,
  }

  const r = await fetch(WFP_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  })

  const j = await r.json().catch(() => ({}))
  return { httpOk: r.ok, status: r.status, body: j }
}

async function handler(req: NextRequest) {
  const url = new URL(req.url)
  const debug = url.searchParams.get("debug") === "1"

  const orderReference =
    url.searchParams.get("orderReference") || (req.cookies.get("ta_last_order")?.value || "")

  if (!orderReference) {
    return NextResponse.json({ ok: false, error: "Missing orderReference" }, { status: 400 })
  }

  const sb = sbAdmin()

  const wfp = await fetchWfpStatus(orderReference)
  const txStatus = String((wfp.body as any)?.transactionStatus || (wfp.body as any)?.status || "")
  const state = mapStatus(txStatus)

  const raw = (wfp.body && typeof wfp.body === "object" ? wfp.body : {}) as any

  const upd = await sb
    .from("billing_orders")
    .update({
      status: state,
      raw,
      updated_at: new Date().toISOString(),
    })
    .eq("order_reference", orderReference)

  const updErr = upd.error ? upd.error.message : null

  if (state !== "paid") {
    return NextResponse.json(
      {
        ok: false,
        state,
        txStatus,
        orderReference,
        billingUpdated: !upd.error,
        billingUpdateError: updErr,
        ...(debug ? { wfp } : {}),
      },
      { status: 200 }
    )
  }

  const grant = await ensurePaidGrant(sb, orderReference)

  return NextResponse.json(
    {
      ok: true,
      state,
      txStatus,
      orderReference,
      billingUpdated: !upd.error,
      billingUpdateError: updErr,
      grant,
      ...(debug ? { wfp } : {}),
    },
    { status: 200 }
  )
}

export async function GET(req: NextRequest) {
  try {
    return await handler(req)
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "Sync failed", details: String(e?.message || e) },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    return await handler(req)
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "Sync failed", details: String(e?.message || e) },
      { status: 500 }
    )
  }
}
